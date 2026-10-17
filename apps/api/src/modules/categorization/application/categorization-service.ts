import type { TransactionKind } from "../../invoices/domain/parsed-invoice";
import type { ClassifiedTransaction, TransactionClassifier } from "../../invoices/domain/ports";
import { categorize, type CategorizerContext } from "../domain/categorizer";
import { merchantKeyOf } from "../domain/merchant-key";
import type { CategoryLookup, CategoryRuleRepository } from "../domain/ports";

/** Monta o contexto de categorização de um usuário e classifica transações novas (usado na importação). */
export class CategorizationService implements TransactionClassifier {
  constructor(private readonly deps: { rules: CategoryRuleRepository; categories: CategoryLookup }) {}

  async contextFor(userId: string): Promise<CategorizerContext> {
    const [userRules, categoryIdBySlug] = await Promise.all([
      this.deps.rules.mapByUser(userId),
      this.deps.categories.idBySlug(),
    ]);
    return { userRules, categoryIdBySlug };
  }

  async classify(
    userId: string,
    transactions: { description: string; kind: TransactionKind }[],
  ): Promise<ClassifiedTransaction[]> {
    const context = await this.contextFor(userId);
    return transactions.map((t) => {
      const merchantKey = merchantKeyOf(t.description);
      const assignment = categorize({ kind: t.kind, merchantKey }, context);
      return {
        merchantKey,
        categoryId: assignment?.categoryId ?? null,
        categorySource: assignment?.source ?? null,
      };
    });
  }
}
