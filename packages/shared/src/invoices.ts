import { z } from "zod";
import { categorySourceSchema } from "./categorization";

// Valores monetários trafegam sempre em centavos (inteiro) para evitar erro de ponto flutuante.
// Datas sem hora trafegam como "YYYY-MM-DD".

export const transactionKindSchema = z.enum(["PURCHASE", "REFUND", "IOF", "FEE", "PAYMENT"]);

export const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  /** Positivo = cobrança; negativo = crédito (pagamento, estorno). */
  amountCents: z.number().int(),
  kind: transactionKindSchema,
  cardLast4: z.string().nullable(),
  installment: z.object({ current: z.number().int(), total: z.number().int() }).nullable(),
  foreign: z.object({ currency: z.string(), amountCents: z.number().int() }).nullable(),
  categoryId: z.string().nullable(),
  categorySource: categorySourceSchema.nullable(),
  /** Nome normalizado do estabelecimento; transações com a mesma chave são o mesmo lugar. */
  merchantKey: z.string(),
});

export const invoiceSummarySchema = z.object({
  id: z.string(),
  issuer: z.string(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/), // "2026-10"
  dueDate: z.string(),
  closingDate: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalCents: z.number().int(),
  /** Soma de compras + IOF + encargos − estornos: o que foi gasto no período. */
  spentCents: z.number().int(),
  /** Quantidade de lançamentos de gasto (pagamentos não contam). */
  transactionCount: z.number().int(),
  importedAt: z.string(),
});

export const invoiceDetailSchema = invoiceSummarySchema.extend({
  transactions: z.array(transactionSchema),
});

export const importInvoiceResultSchema = z.object({
  invoice: invoiceSummarySchema,
  /** true quando já existia fatura do mesmo mês e ela foi substituída. */
  replaced: z.boolean(),
});

export type TransactionKindDTO = z.infer<typeof transactionKindSchema>;
export type TransactionDTO = z.infer<typeof transactionSchema>;
export type InvoiceSummaryDTO = z.infer<typeof invoiceSummarySchema>;
export type InvoiceDetailDTO = z.infer<typeof invoiceDetailSchema>;
export type ImportInvoiceResultDTO = z.infer<typeof importInvoiceResultSchema>;
