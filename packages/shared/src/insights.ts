import { z } from "zod";

const month = z.string().regex(/^\d{4}-\d{2}$/);

export const insightsSchema = z.object({
  /** Todos os meses com fatura, do mais antigo ao mais recente. */
  months: z.array(z.object({ referenceMonth: month, invoiceId: z.string(), spentCents: z.number().int() })),
  /** Mês exibido (null se não há faturas). */
  month: month.nullable(),
  previousMonth: month.nullable(),
  summary: z.object({
    spentCents: z.number().int(),
    previousSpentCents: z.number().int().nullable(),
    purchaseCount: z.number().int(),
    averageTicketCents: z.number().int(),
    futureInstallmentsCents: z.number().int(),
  }),
  byCategory: z.array(
    z.object({
      categoryId: z.string().nullable(),
      name: z.string(),
      color: z.string().nullable(),
      cents: z.number().int(),
      previousCents: z.number().int(),
      count: z.number().int(),
    }),
  ),
  /** Gasto acumulado por dia do ciclo da fatura (índice 0 = primeiro dia do período). */
  dailyCumulative: z.object({ current: z.array(z.number().int()), previous: z.array(z.number().int()).nullable() }),
  topMerchants: z.array(
    z.object({
      merchantKey: z.string(),
      description: z.string(),
      categoryId: z.string().nullable(),
      count: z.number().int(),
      cents: z.number().int(),
    }),
  ),
  /** Parcelas de compras já feitas que vão cair nas próximas faturas. */
  futureInstallments: z.array(z.object({ month, cents: z.number().int() })),
});

export type InsightsDTO = z.infer<typeof insightsSchema>;
