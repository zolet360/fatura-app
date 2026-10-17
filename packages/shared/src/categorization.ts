import { z } from "zod";

export const categorySourceSchema = z.enum(["SYSTEM_RULE", "USER_RULE", "MANUAL"]);

export const pendingMerchantSchema = z.object({
  merchantKey: z.string(),
  description: z.string(),
  count: z.number().int(),
  totalCents: z.number().int(),
  lastDate: z.string(),
});

export const setMerchantCategorySchema = z.object({
  merchantKey: z.string().min(1),
  categoryId: z.string().min(1),
});

export const setTransactionCategorySchema = z.object({
  /** null desfaz a escolha manual e volta para a categoria automática. */
  categoryId: z.string().min(1).nullable(),
});

export const transactionCategorySchema = z.object({
  categoryId: z.string().nullable(),
  categorySource: categorySourceSchema.nullable(),
});

export type CategorySourceDTO = z.infer<typeof categorySourceSchema>;
export type PendingMerchantDTO = z.infer<typeof pendingMerchantSchema>;
export type SetMerchantCategoryInput = z.infer<typeof setMerchantCategorySchema>;
export type SetTransactionCategoryInput = z.infer<typeof setTransactionCategorySchema>;
export type TransactionCategoryDTO = z.infer<typeof transactionCategorySchema>;
