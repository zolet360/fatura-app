import type { Database } from "../../../infra/database/prisma";
import {
  spendingOf,
  spentCents,
  type InvoiceDetail,
  type InvoiceSummary,
  type Transaction,
} from "../domain/invoice";
import { referenceMonthOf } from "../domain/parsed-invoice";
import type { InvoiceRepository, ManualCategory } from "../domain/ports";

type InvoiceRow = Awaited<ReturnType<Database["invoice"]["findFirstOrThrow"]>>;
type TransactionRow = Awaited<ReturnType<Database["transaction"]["findFirstOrThrow"]>>;

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amountCents: row.amountCents,
    kind: row.kind,
    cardLast4: row.cardLast4,
    installment:
      row.installmentCurrent !== null && row.installmentTotal !== null
        ? { current: row.installmentCurrent, total: row.installmentTotal }
        : null,
    foreign:
      row.foreignCurrency !== null && row.foreignAmountCents !== null
        ? { currency: row.foreignCurrency, amountCents: row.foreignAmountCents }
        : null,
    categoryId: row.categoryId,
    categorySource: row.categorySource,
    merchantKey: row.merchantKey,
  };
}

function toSummary(row: InvoiceRow, transactions: Pick<TransactionRow, "kind" | "amountCents">[]): InvoiceSummary {
  return {
    id: row.id,
    issuer: row.issuer,
    referenceMonth: row.referenceMonth,
    dueDate: row.dueDate,
    closingDate: row.closingDate,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    totalCents: row.totalCents,
    spentCents: spentCents(transactions),
    transactionCount: spendingOf(transactions).length,
    importedAt: row.updatedAt,
  };
}

export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: Database) {}

  async findManualCategories(userId: string, issuer: string, referenceMonth: string): Promise<ManualCategory[]> {
    const rows = await this.db.transaction.findMany({
      where: { categorySource: "MANUAL", invoice: { userId, issuer, referenceMonth } },
      select: { date: true, description: true, amountCents: true, categoryId: true },
      orderBy: { position: "asc" },
    });
    return rows.flatMap((r) => (r.categoryId ? [{ ...r, categoryId: r.categoryId }] : []));
  }

  async saveImported(
    userId: string,
    parsed: Parameters<InvoiceRepository["saveImported"]>[1],
    file: { key: string; hash: string },
  ) {
    const referenceMonth = referenceMonthOf(parsed);
    const fields = {
      dueDate: parsed.dueDate,
      closingDate: parsed.closingDate,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      totalCents: parsed.totalCents,
      sourceFile: file.key,
      fileHash: file.hash,
    };

    return this.db.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { userId_issuer_referenceMonth: { userId, issuer: parsed.issuer, referenceMonth } },
        select: { id: true, sourceFile: true },
      });

      // Reimportação mantém o id da fatura (links continuam válidos) e troca todas as transações.
      const invoice = existing
        ? await tx.invoice.update({ where: { id: existing.id }, data: fields })
        : await tx.invoice.create({ data: { userId, issuer: parsed.issuer, referenceMonth, ...fields } });
      if (existing) await tx.transaction.deleteMany({ where: { invoiceId: invoice.id } });

      await tx.transaction.createMany({
        data: parsed.transactions.map((t, position) => ({
          invoiceId: invoice.id,
          position,
          date: t.date,
          description: t.description,
          merchantKey: t.merchantKey,
          amountCents: t.amountCents,
          kind: t.kind,
          categoryId: t.categoryId,
          categorySource: t.categorySource,
          cardLast4: t.cardLast4,
          installmentCurrent: t.installment?.current ?? null,
          installmentTotal: t.installment?.total ?? null,
          foreignCurrency: t.foreign?.currency ?? null,
          foreignAmountCents: t.foreign?.amountCents ?? null,
        })),
      });

      return {
        invoice: toSummary(invoice, parsed.transactions),
        replaced: existing !== null,
        previousSourceFile: existing?.sourceFile ?? null,
      };
    });
  }

  async listByUser(userId: string): Promise<InvoiceSummary[]> {
    const rows = await this.db.invoice.findMany({
      where: { userId },
      orderBy: { dueDate: "desc" },
      include: { transactions: { select: { kind: true, amountCents: true } } },
    });
    return rows.map(({ transactions, ...row }) => toSummary(row, transactions));
  }

  async findByIdForUser(id: string, userId: string): Promise<InvoiceDetail | null> {
    const row = await this.db.invoice.findFirst({
      where: { id, userId },
      include: { transactions: { orderBy: { position: "asc" } } },
    });
    if (!row) return null;
    const { transactions, ...invoice } = row;
    return { ...toSummary(invoice, transactions), transactions: transactions.map(toTransaction) };
  }

  async deleteForUser(id: string, userId: string) {
    const row = await this.db.invoice.findFirst({ where: { id, userId }, select: { sourceFile: true } });
    if (!row) return null;
    await this.db.invoice.delete({ where: { id } });
    return { sourceFile: row.sourceFile };
  }
}
