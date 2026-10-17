import type { TransactionKind } from "../../invoices/domain/parsed-invoice";
import { FEES_CATEGORY, matchSystemRule } from "./system-rules";

/**
 * De onde veio a categoria de uma transação. MANUAL nunca é sobrescrita automaticamente;
 * as outras são recalculadas quando regras mudam.
 */
export const CATEGORY_SOURCES = ["SYSTEM_RULE", "USER_RULE", "MANUAL"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];

export interface CategoryAssignment {
  categoryId: string;
  source: Exclude<CategorySource, "MANUAL">;
}

/** Tipos que recebem categoria por estabelecimento. Pagamento não é gasto e fica sem categoria. */
export const CATEGORIZABLE_KINDS: readonly TransactionKind[] = ["PURCHASE", "REFUND"];

export interface CategorizerContext {
  /** merchantKey → categoryId, regras criadas pelo usuário. */
  userRules: ReadonlyMap<string, string>;
  /** slug → categoryId, para traduzir as regras padrão. */
  categoryIdBySlug: ReadonlyMap<string, string>;
}

/** Decide a categoria automática. Ordem: tarifas por tipo, regra do usuário, regra padrão. */
export function categorize(
  transaction: { kind: TransactionKind; merchantKey: string },
  context: CategorizerContext,
): CategoryAssignment | null {
  const bySlug = (slug: string | null) => (slug ? (context.categoryIdBySlug.get(slug) ?? null) : null);

  if (transaction.kind === "IOF" || transaction.kind === "FEE") {
    const categoryId = bySlug(FEES_CATEGORY);
    return categoryId ? { categoryId, source: "SYSTEM_RULE" } : null;
  }
  if (!CATEGORIZABLE_KINDS.includes(transaction.kind)) return null;

  const userCategoryId = context.userRules.get(transaction.merchantKey);
  if (userCategoryId) return { categoryId: userCategoryId, source: "USER_RULE" };

  const systemCategoryId = bySlug(matchSystemRule(transaction.merchantKey));
  return systemCategoryId ? { categoryId: systemCategoryId, source: "SYSTEM_RULE" } : null;
}
