import { AppError, NotFoundError } from "../../../shared/errors";
import { categorize } from "../domain/categorizer";
import { merchantKeyOf } from "../domain/merchant-key";
import type {
  CategoryChange,
  CategoryLookup,
  CategoryRuleRepository,
  PendingMerchant,
  TransactionCategoryRepository,
} from "../domain/ports";
import type { CategorizationService } from "./categorization-service";

interface Deps {
  rules: CategoryRuleRepository;
  categories: CategoryLookup;
  transactions: TransactionCategoryRepository;
  service: CategorizationService;
}

async function ensureCategory(categories: CategoryLookup, categoryId: string) {
  if (!(await categories.exists(categoryId))) throw new AppError("Categoria inexistente", "INVALID_CATEGORY");
}

/** Estabelecimentos com gastos sem categoria, do maior valor para o menor. */
export class ListPendingMerchants {
  constructor(private readonly deps: Pick<Deps, "transactions">) {}

  execute(userId: string): Promise<PendingMerchant[]> {
    return this.deps.transactions.listPending(userId);
  }
}

/** "Sempre que aparecer este estabelecimento, use esta categoria": cria a regra e aplica ao histórico. */
export class SetMerchantCategory {
  constructor(private readonly deps: Pick<Deps, "rules" | "categories" | "transactions">) {}

  async execute(userId: string, merchantKey: string, categoryId: string): Promise<{ updated: number }> {
    if (merchantKey.trim() === "") throw new AppError("Estabelecimento inválido", "INVALID_MERCHANT");
    await ensureCategory(this.deps.categories, categoryId);
    await this.deps.rules.upsert(userId, merchantKey, categoryId);
    return { updated: await this.deps.transactions.applyRule(userId, merchantKey, categoryId) };
  }
}

/**
 * Categoria de uma transação só (exceção). Com categoryId null, desfaz a escolha manual e
 * volta para a categoria automática.
 */
export class SetTransactionCategory {
  constructor(private readonly deps: Deps) {}

  async execute(userId: string, transactionId: string, categoryId: string | null): Promise<CategoryChange> {
    const transaction = await this.deps.transactions.findForUser(transactionId, userId);
    if (!transaction) throw new NotFoundError("Transação não encontrada");
    if (transaction.kind === "PAYMENT") throw new AppError("Pagamentos não têm categoria", "NOT_CATEGORIZABLE");

    let change: CategoryChange;
    if (categoryId) {
      await ensureCategory(this.deps.categories, categoryId);
      change = { categoryId, source: "MANUAL" };
    } else {
      const assignment = categorize(transaction, await this.deps.service.contextFor(userId));
      change = { categoryId: assignment?.categoryId ?? null, source: assignment?.source ?? null };
    }
    await this.deps.transactions.setCategory(transaction.id, change);
    return change;
  }
}

/**
 * Recalcula chave e categoria automática de todas as transações do usuário (escolhas manuais
 * são preservadas). Usado quando as regras padrão mudam e para preencher dados antigos.
 */
export class RecategorizeAll {
  constructor(private readonly deps: Pick<Deps, "transactions" | "service">) {}

  async execute(userId: string): Promise<{ changed: number }> {
    const [transactions, context] = await Promise.all([
      this.deps.transactions.listForUser(userId),
      this.deps.service.contextFor(userId),
    ]);

    const updates = transactions.flatMap((t) => {
      const merchantKey = merchantKeyOf(t.description);
      if (t.categorySource === "MANUAL") {
        return merchantKey === t.merchantKey ? [] : [{ id: t.id, merchantKey }];
      }
      const assignment = categorize({ kind: t.kind, merchantKey }, context);
      const category = { categoryId: assignment?.categoryId ?? null, source: assignment?.source ?? null };
      const unchanged =
        merchantKey === t.merchantKey && category.categoryId === t.categoryId && category.source === t.categorySource;
      return unchanged ? [] : [{ id: t.id, merchantKey, category }];
    });

    await this.deps.transactions.updateMany(updates);
    return { changed: updates.length };
  }
}
