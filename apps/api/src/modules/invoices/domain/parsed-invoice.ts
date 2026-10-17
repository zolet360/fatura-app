import { UnprocessableError } from "../../../shared/errors";

/**
 * PURCHASE compra (inclui parcelas) · REFUND estorno/crédito · IOF imposto sobre compra internacional
 * FEE juros, multa e encargos · PAYMENT pagamento da fatura (não é gasto)
 */
export const TRANSACTION_KINDS = ["PURCHASE", "REFUND", "IOF", "FEE", "PAYMENT"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export interface ParsedTransaction {
  /** Data em UTC à meia-noite (só a data importa). */
  date: Date;
  description: string;
  /** Positivo = cobrança; negativo = crédito (pagamento, estorno). */
  amountCents: number;
  kind: TransactionKind;
  cardLast4: string | null;
  installment: { current: number; total: number } | null;
  /** Valor na moeda original, para compras internacionais. */
  foreign: { currency: string; amountCents: number } | null;
}

export interface ParsedInvoice {
  issuer: string;
  dueDate: Date;
  closingDate: Date;
  periodStart: Date;
  periodEnd: Date;
  totalCents: number;
  transactions: ParsedTransaction[];
}

export class InvoiceParseError extends UnprocessableError {
  constructor(message: string, code = "INVOICE_PARSE_FAILED") {
    super(message, code);
  }
}

/** "2026-10" a partir do vencimento: a "fatura de outubro" é a que vence em outubro. */
export function referenceMonthOf(invoice: Pick<ParsedInvoice, "dueDate">): string {
  return invoice.dueDate.toISOString().slice(0, 7);
}
