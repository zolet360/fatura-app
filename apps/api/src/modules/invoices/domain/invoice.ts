import type { CategorySource } from "../../categorization/domain/categorizer";
import type { TransactionKind } from "./parsed-invoice";

export interface InvoiceSummary {
  id: string;
  issuer: string;
  referenceMonth: string;
  dueDate: Date;
  closingDate: Date;
  periodStart: Date;
  periodEnd: Date;
  totalCents: number;
  spentCents: number;
  /** Só lançamentos de gasto (sem pagamentos), o mesmo que a tela da fatura lista em "Gastos". */
  transactionCount: number;
  importedAt: Date;
}

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  kind: TransactionKind;
  cardLast4: string | null;
  installment: { current: number; total: number } | null;
  foreign: { currency: string; amountCents: number } | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  merchantKey: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  transactions: Transaction[];
}

/** Tipos que contam como gasto. Pagamento da fatura não é gasto, só quita o saldo anterior. */
export const SPENDING_KINDS: readonly TransactionKind[] = ["PURCHASE", "REFUND", "IOF", "FEE"];

export function spendingOf<T extends Pick<Transaction, "kind">>(transactions: T[]): T[] {
  return transactions.filter((t) => SPENDING_KINDS.includes(t.kind));
}

export function spentCents(transactions: Pick<Transaction, "kind" | "amountCents">[]): number {
  return spendingOf(transactions).reduce((sum, t) => sum + t.amountCents, 0);
}
