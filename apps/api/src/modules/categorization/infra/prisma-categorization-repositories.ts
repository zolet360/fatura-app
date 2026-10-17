import type { Database } from "../../../infra/database/prisma";
import { CATEGORIZABLE_KINDS } from "../domain/categorizer";
import type {
  CategorizableTransaction,
  CategoryChange,
  CategoryLookup,
  CategoryRuleRepository,
  PendingMerchant,
  TransactionCategoryRepository,
} from "../domain/ports";

const categorizableSelect = {
  id: true,
  description: true,
  merchantKey: true,
  kind: true,
  categoryId: true,
  categorySource: true,
} as const;

export class PrismaCategoryRuleRepository implements CategoryRuleRepository {
  constructor(private readonly db: Database) {}

  async mapByUser(userId: string): Promise<Map<string, string>> {
    const rules = await this.db.categoryRule.findMany({ where: { userId }, select: { merchantKey: true, categoryId: true } });
    return new Map(rules.map((r) => [r.merchantKey, r.categoryId]));
  }

  async upsert(userId: string, merchantKey: string, categoryId: string): Promise<void> {
    await this.db.categoryRule.upsert({
      where: { userId_merchantKey: { userId, merchantKey } },
      update: { categoryId },
      create: { userId, merchantKey, categoryId },
    });
  }
}

export class PrismaCategoryLookup implements CategoryLookup {
  constructor(private readonly db: Database) {}

  async idBySlug(): Promise<Map<string, string>> {
    const categories = await this.db.category.findMany({ select: { id: true, slug: true } });
    return new Map(categories.map((c) => [c.slug, c.id]));
  }

  async exists(categoryId: string): Promise<boolean> {
    return (await this.db.category.count({ where: { id: categoryId } })) > 0;
  }
}

export class PrismaTransactionCategoryRepository implements TransactionCategoryRepository {
  constructor(private readonly db: Database) {}

  findForUser(transactionId: string, userId: string): Promise<CategorizableTransaction | null> {
    return this.db.transaction.findFirst({
      where: { id: transactionId, invoice: { userId } },
      select: categorizableSelect,
    });
  }

  listForUser(userId: string): Promise<CategorizableTransaction[]> {
    return this.db.transaction.findMany({ where: { invoice: { userId } }, select: categorizableSelect });
  }

  async applyRule(userId: string, merchantKey: string, categoryId: string): Promise<number> {
    const { count } = await this.db.transaction.updateMany({
      where: {
        merchantKey,
        kind: { in: [...CATEGORIZABLE_KINDS] },
        invoice: { userId },
        // `not: MANUAL` sozinho excluiria as nulas (comparação com NULL em SQL), daí o OR.
        OR: [{ categorySource: null }, { categorySource: { not: "MANUAL" } }],
      },
      data: { categoryId, categorySource: "USER_RULE" },
    });
    return count;
  }

  async setCategory(transactionId: string, change: CategoryChange): Promise<void> {
    await this.db.transaction.update({
      where: { id: transactionId },
      data: { categoryId: change.categoryId, categorySource: change.source },
    });
  }

  async updateMany(updates: { id: string; merchantKey: string; category?: CategoryChange }[]): Promise<void> {
    if (updates.length === 0) return;
    await this.db.$transaction(
      updates.map((u) =>
        this.db.transaction.update({
          where: { id: u.id },
          data: {
            merchantKey: u.merchantKey,
            ...(u.category && { categoryId: u.category.categoryId, categorySource: u.category.source }),
          },
        }),
      ),
    );
  }

  async listPending(userId: string): Promise<PendingMerchant[]> {
    const where = { categoryId: null, kind: { in: [...CATEGORIZABLE_KINDS] }, invoice: { userId } };
    const [groups, latest] = await Promise.all([
      this.db.transaction.groupBy({
        by: ["merchantKey"],
        where,
        _count: { _all: true },
        _sum: { amountCents: true },
        _max: { date: true },
      }),
      // Descrição mais recente de cada estabelecimento, para exibir.
      this.db.transaction.findMany({
        where,
        distinct: ["merchantKey"],
        orderBy: [{ merchantKey: "asc" }, { date: "desc" }],
        select: { merchantKey: true, description: true },
      }),
    ]);

    const descriptionByKey = new Map(latest.map((t) => [t.merchantKey, t.description]));
    return groups
      .map((g) => ({
        merchantKey: g.merchantKey,
        description: descriptionByKey.get(g.merchantKey) ?? g.merchantKey,
        count: g._count._all,
        totalCents: g._sum.amountCents ?? 0,
        lastDate: g._max.date ?? new Date(0),
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
