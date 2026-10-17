import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildInsights,
  type InsightInvoice,
  type InsightTransaction,
} from "../../src/modules/insights/domain/build-insights";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function tx(partial: Partial<InsightTransaction> & Pick<InsightTransaction, "amountCents">): InsightTransaction {
  return {
    date: d("2026-09-10"),
    description: "Loja",
    merchantKey: "LOJA",
    kind: "PURCHASE",
    categoryId: null,
    installment: null,
    ...partial,
  };
}

const categories = [
  { id: "food", name: "Alimentação", color: "#f97316" },
  { id: "health", name: "Saúde", color: "#ef4444" },
];

const september: InsightInvoice = {
  id: "inv-9",
  referenceMonth: "2026-09",
  periodStart: d("2026-08-04"),
  periodEnd: d("2026-09-04"),
  transactions: [
    tx({ date: d("2026-08-05"), amountCents: 10000, categoryId: "food" }),
    tx({ date: d("2026-08-20"), amountCents: 5000, categoryId: "health" }),
    tx({ date: d("2026-08-08"), amountCents: -20000, kind: "PAYMENT" }),
  ],
};

const october: InsightInvoice = {
  id: "inv-10",
  referenceMonth: "2026-10",
  periodStart: d("2026-09-04"),
  periodEnd: d("2026-10-04"),
  transactions: [
    tx({ date: d("2026-09-04"), amountCents: 3000, categoryId: "food", merchantKey: "PIZZA", description: "Pizza" }),
    tx({ date: d("2026-09-10"), amountCents: 2000, categoryId: "food", merchantKey: "PIZZA", description: "Pizza 2" }),
    tx({ date: d("2026-09-12"), amountCents: 12000, merchantKey: "TV", installment: { current: 1, total: 3 } }),
    tx({ date: d("2026-09-15"), amountCents: 500, kind: "IOF", merchantKey: "IOF" }),
    tx({
      date: d("2026-09-20"),
      amountCents: -1000,
      kind: "REFUND",
      categoryId: "food",
      merchantKey: "PIZZA",
      description: "Estorno de Pizza",
    }),
    tx({ date: d("2026-09-08"), amountCents: -15000, kind: "PAYMENT" }),
  ],
};

describe("buildInsights", () => {
  const insights = buildInsights([october, september], categories, null);

  it("usa o mês mais recente por padrão e compara com o anterior", () => {
    expect(insights.month).toBe("2026-10");
    expect(insights.previousMonth).toBe("2026-09");
    expect(insights.months.map((m) => [m.referenceMonth, m.spentCents])).toEqual([
      ["2026-09", 15000],
      ["2026-10", 16500],
    ]);
  });

  it("resume o mês sem contar pagamentos, abatendo estornos", () => {
    expect(insights.summary).toEqual({
      spentCents: 16500, // 3000 + 2000 + 12000 + 500 - 1000
      previousSpentCents: 15000,
      purchaseCount: 3,
      averageTicketCents: Math.round(17000 / 3),
      futureInstallmentsCents: 24000, // TV: parcelas 2/3 e 3/3
    });
  });

  it("totaliza por categoria com o valor do mês anterior ao lado", () => {
    expect(insights.byCategory).toEqual([
      { categoryId: null, name: "Sem categoria", color: null, cents: 12500, previousCents: 0, count: 2 },
      { categoryId: "food", name: "Alimentação", color: "#f97316", cents: 4000, previousCents: 10000, count: 3 },
      { categoryId: "health", name: "Saúde", color: "#ef4444", cents: 0, previousCents: 5000, count: 0 },
    ]);
  });

  it("agrupa estabelecimentos pela chave, com o nome da compra mais recente (não do estorno)", () => {
    expect(insights.topMerchants[0]).toMatchObject({ merchantKey: "TV", cents: 12000, count: 1 });
    expect(insights.topMerchants.find((m) => m.merchantKey === "PIZZA")).toMatchObject({
      description: "Pizza 2",
      count: 3,
      cents: 4000,
    });
  });

  it("acumula o gasto por dia do ciclo", () => {
    const { current, previous } = insights.dailyCumulative;
    expect(current).toHaveLength(31); // 04/09 a 04/10
    expect(current[0]).toBe(3000);
    expect(current[6]).toBe(5000); // 10/09
    expect(current.at(-1)).toBe(16500);
    expect(previous?.at(-1)).toBe(15000);
  });

  it("projeta as parcelas restantes nas próximas faturas", () => {
    expect(insights.futureInstallments).toEqual([
      { month: "2026-11", cents: 12000 },
      { month: "2026-12", cents: 12000 },
    ]);
  });

  it("aceita escolher um mês específico", () => {
    const past = buildInsights([october, september], categories, "2026-09");
    expect(past.month).toBe("2026-09");
    expect(past.previousMonth).toBeNull();
    expect(past.summary.previousSpentCents).toBeNull();
  });

  it("sem faturas, devolve painel vazio", () => {
    const empty = buildInsights([], categories, null);
    expect(empty.month).toBeNull();
    expect(empty.byCategory).toEqual([]);
  });
});

describe("addMonths", () => {
  it("vira o ano", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
