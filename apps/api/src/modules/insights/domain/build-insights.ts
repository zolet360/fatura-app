import { SPENDING_KINDS } from "../../invoices/domain/invoice";
import type { TransactionKind } from "../../invoices/domain/parsed-invoice";

export interface InsightTransaction {
  date: Date;
  description: string;
  merchantKey: string;
  amountCents: number;
  kind: TransactionKind;
  categoryId: string | null;
  installment: { current: number; total: number } | null;
}

export interface InsightInvoice {
  id: string;
  referenceMonth: string;
  periodStart: Date;
  periodEnd: Date;
  transactions: InsightTransaction[];
}

export interface InsightCategory {
  id: string;
  name: string;
  color: string;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  color: string | null;
  cents: number;
  previousCents: number;
  count: number;
}

export interface Insights {
  months: { referenceMonth: string; invoiceId: string; spentCents: number }[];
  month: string | null;
  previousMonth: string | null;
  summary: {
    spentCents: number;
    previousSpentCents: number | null;
    purchaseCount: number;
    averageTicketCents: number;
    futureInstallmentsCents: number;
  };
  byCategory: CategoryTotal[];
  /** Gasto acumulado por dia do ciclo (dia 1 = início do período da fatura). */
  dailyCumulative: { current: number[]; previous: number[] | null };
  topMerchants: { merchantKey: string; description: string; categoryId: string | null; count: number; cents: number }[];
  futureInstallments: { month: string; cents: number }[];
}

const UNCATEGORIZED = "Sem categoria";
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_MERCHANTS = 8;

const isSpending = (t: InsightTransaction) => SPENDING_KINDS.includes(t.kind);
const sum = (list: InsightTransaction[]) => list.reduce((acc, t) => acc + t.amountCents, 0);

export function addMonths(referenceMonth: string, offset: number): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function cumulativeByDay(invoice: InsightInvoice): number[] {
  const days = Math.round((invoice.periodEnd.getTime() - invoice.periodStart.getTime()) / DAY_MS) + 1;
  const perDay = new Array<number>(days).fill(0);
  for (const t of invoice.transactions.filter(isSpending)) {
    // Parcelas antigas podem vir com data anterior ao período: contam no primeiro dia.
    const index = Math.min(days - 1, Math.max(0, Math.round((t.date.getTime() - invoice.periodStart.getTime()) / DAY_MS)));
    perDay[index]! += t.amountCents;
  }
  let running = 0;
  return perDay.map((cents) => (running += cents));
}

/**
 * Indicadores do painel para um mês de fatura. Pura: recebe as faturas do usuário e calcula tudo
 * em memória (volume de uma pessoa é pequeno: dezenas de faturas, centenas de transações).
 */
export function buildInsights(
  invoices: InsightInvoice[],
  categories: InsightCategory[],
  requestedMonth: string | null,
): Insights {
  const sorted = [...invoices].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  const months = sorted.map((i) => ({
    referenceMonth: i.referenceMonth,
    invoiceId: i.id,
    spentCents: sum(i.transactions.filter(isSpending)),
  }));

  const currentIndex = requestedMonth
    ? sorted.findIndex((i) => i.referenceMonth === requestedMonth)
    : sorted.length - 1;
  const current = sorted[currentIndex];
  const previous = current && currentIndex > 0 ? sorted[currentIndex - 1] : undefined;

  if (!current) {
    return {
      months,
      month: null,
      previousMonth: null,
      summary: { spentCents: 0, previousSpentCents: null, purchaseCount: 0, averageTicketCents: 0, futureInstallmentsCents: 0 },
      byCategory: [],
      dailyCumulative: { current: [], previous: null },
      topMerchants: [],
      futureInstallments: [],
    };
  }

  const spending = current.transactions.filter(isSpending);
  const previousSpending = previous?.transactions.filter(isSpending) ?? [];
  const purchases = current.transactions.filter((t) => t.kind === "PURCHASE");
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Por categoria: valores do mês e do anterior lado a lado, para o comparativo.
  const totals = new Map<string | null, CategoryTotal>();
  const totalFor = (categoryId: string | null) => {
    let total = totals.get(categoryId);
    if (!total) {
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      total = {
        categoryId,
        name: category?.name ?? UNCATEGORIZED,
        color: category?.color ?? null,
        cents: 0,
        previousCents: 0,
        count: 0,
      };
      totals.set(categoryId, total);
    }
    return total;
  };
  for (const t of spending) {
    const total = totalFor(t.categoryId);
    total.cents += t.amountCents;
    total.count += 1;
  }
  for (const t of previousSpending) totalFor(t.categoryId).previousCents += t.amountCents;
  const byCategory = [...totals.values()].sort((a, b) => b.cents - a.cents || b.previousCents - a.previousCents);

  // Estabelecimentos: agrupados pela chave normalizada, descrição da compra mais recente.
  const merchants = new Map<string, Insights["topMerchants"][number] & { lastDate: number }>();
  for (const t of spending) {
    const entry = merchants.get(t.merchantKey) ?? {
      merchantKey: t.merchantKey,
      description: t.description,
      categoryId: t.categoryId,
      count: 0,
      cents: 0,
      lastDate: 0,
    };
    entry.count += 1;
    entry.cents += t.amountCents;
    // Nome exibido vem da compra mais recente; estorno ("Estorno de ...") não renomeia o lugar.
    if (t.kind !== "REFUND" && t.date.getTime() >= entry.lastDate) {
      entry.lastDate = t.date.getTime();
      entry.description = t.description;
      entry.categoryId = t.categoryId;
    }
    merchants.set(t.merchantKey, entry);
  }
  const topMerchants = [...merchants.values()]
    .sort((a, b) => b.cents - a.cents)
    .slice(0, TOP_MERCHANTS)
    .map(({ lastDate: _, ...m }) => m);

  // Parcelas restantes de compras parceladas: cada parcela futura cai na fatura do mês seguinte.
  const future = new Map<string, number>();
  for (const t of purchases) {
    if (!t.installment || t.installment.current >= t.installment.total) continue;
    for (let k = 1; k <= t.installment.total - t.installment.current; k++) {
      const month = addMonths(current.referenceMonth, k);
      future.set(month, (future.get(month) ?? 0) + t.amountCents);
    }
  }
  const futureInstallments = [...future.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cents]) => ({ month, cents }));

  const purchasesCents = sum(purchases);
  return {
    months,
    month: current.referenceMonth,
    previousMonth: previous?.referenceMonth ?? null,
    summary: {
      spentCents: sum(spending),
      previousSpentCents: previous ? sum(previousSpending) : null,
      purchaseCount: purchases.length,
      averageTicketCents: purchases.length ? Math.round(purchasesCents / purchases.length) : 0,
      futureInstallmentsCents: futureInstallments.reduce((acc, f) => acc + f.cents, 0),
    },
    byCategory,
    dailyCumulative: { current: cumulativeByDay(current), previous: previous ? cumulativeByDay(previous) : null },
    topMerchants,
    futureInstallments,
  };
}
