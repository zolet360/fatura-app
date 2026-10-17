import type { TransactionKind } from "../../invoices/domain/parsed-invoice";
import type { CategorySource } from "./categorizer";

export interface CategoryRuleRepository {
  /** merchantKey → categoryId */
  mapByUser(userId: string): Promise<Map<string, string>>;
  upsert(userId: string, merchantKey: string, categoryId: string): Promise<void>;
}

export interface CategoryLookup {
  /** slug → id */
  idBySlug(): Promise<Map<string, string>>;
  exists(categoryId: string): Promise<boolean>;
}

export interface PendingMerchant {
  merchantKey: string;
  /** Descrição como aparece na fatura (a mais recente), para o usuário reconhecer o lugar. */
  description: string;
  count: number;
  totalCents: number;
  lastDate: Date;
}

export interface CategorizableTransaction {
  id: string;
  description: string;
  merchantKey: string;
  kind: TransactionKind;
  categoryId: string | null;
  categorySource: CategorySource | null;
}

export interface CategoryChange {
  categoryId: string | null;
  source: CategorySource | null;
}

export interface TransactionCategoryRepository {
  findForUser(transactionId: string, userId: string): Promise<CategorizableTransaction | null>;
  listForUser(userId: string): Promise<CategorizableTransaction[]>;
  /** Aplica a categoria a todas as transações do estabelecimento, exceto as definidas manualmente. */
  applyRule(userId: string, merchantKey: string, categoryId: string): Promise<number>;
  setCategory(transactionId: string, change: CategoryChange): Promise<void>;
  /** Atualização em lote; `category` ausente mantém a categoria atual. */
  updateMany(updates: { id: string; merchantKey: string; category?: CategoryChange }[]): Promise<void>;
  listPending(userId: string): Promise<PendingMerchant[]>;
}
