import { describe, expect, it } from "vitest";
import { categorize, type CategorizerContext } from "../../src/modules/categorization/domain/categorizer";
import { merchantKeyOf } from "../../src/modules/categorization/domain/merchant-key";
import { matchSystemRule } from "../../src/modules/categorization/domain/system-rules";

describe("merchantKeyOf", () => {
  it.each([
    ["Dl*Google Youtub", "GOOGLE YOUTUB"],
    ["Mp *Loja do Zé", "LOJA DO ZE"],
    ["Ebn*Crunchyroll", "CRUNCHYROLL"],
    ["Ec *Loja Exemplo", "LOJA EXEMPLO"],
    ["Mercadolivre*Lojaxyz", "MERCADOLIVRE LOJAXYZ"],
    ["Farmácia São João", "FARMACIA SAO JOAO"],
    ["Estorno de Mp *Loja do Zé", "LOJA DO ZE"],
    ["Apple.Com/Bill", "APPLE COM BILL"],
  ])("%s → %s", (description, key) => {
    expect(merchantKeyOf(description)).toBe(key);
  });

  it("não corta prefixo que não é de intermediador", () => {
    expect(merchantKeyOf("Nuuvem *Nuuvem")).toBe("NUUVEM NUUVEM");
  });
});

describe("regras padrão", () => {
  it.each([
    ["Farmacia Central", "saude"],
    ["Drogasil 123", "saude"],
    ["Pastelaria do Centro", "alimentacao"],
    ["Bella Pizza", "alimentacao"],
    ["Uber Eats", "alimentacao"],
    ["Uber *Trip", "transporte"],
    ["Auto Posto Estrela", "transporte"],
    ["Dl*Google Youtub", "assinaturas"],
    ["Netflix.Com", "assinaturas"],
    ["Mercadolivre*Lojaxyz", "compras"],
    ["Supermercado Bom Preço", "mercado"],
    ["Hiper Exemplo", "mercado"],
    ["Silva Alimentos", "mercado"],
    ["Adiqplu*Atacarejo Exemplo", "mercado"],
    ["Steam Purchase", "lazer"],
  ])("%s → %s", (description, category) => {
    expect(matchSystemRule(merchantKeyOf(description))).toBe(category);
  });

  it("palavra inteira não casa como prefixo", () => {
    expect(matchSystemRule(merchantKeyOf("Barbearia do Zé"))).toBe("servicos"); // não "BAR" → alimentação
    expect(matchSystemRule(merchantKeyOf("Restaurante Tim Tim"))).toBe("alimentacao");
  });

  it("estabelecimento desconhecido fica sem regra", () => {
    expect(matchSystemRule(merchantKeyOf("Xyzabc Comercio"))).toBeNull();
  });
});

describe("categorize", () => {
  const context: CategorizerContext = {
    userRules: new Map([["PASTELARIA DO CENTRO", "cat-lazer"]]),
    categoryIdBySlug: new Map([
      ["alimentacao", "cat-alimentacao"],
      ["tarifas", "cat-tarifas"],
    ]),
  };

  it("regra do usuário vence a regra padrão", () => {
    expect(categorize({ kind: "PURCHASE", merchantKey: "PASTELARIA DO CENTRO" }, context)).toEqual({
      categoryId: "cat-lazer",
      source: "USER_RULE",
    });
  });

  it("sem regra do usuário, usa a padrão", () => {
    expect(categorize({ kind: "PURCHASE", merchantKey: "PIZZARIA X" }, context)).toEqual({
      categoryId: "cat-alimentacao",
      source: "SYSTEM_RULE",
    });
  });

  it("IOF e encargos vão para tarifas, pagamento fica sem categoria", () => {
    expect(categorize({ kind: "IOF", merchantKey: "IOF DE STEAM" }, context)?.categoryId).toBe("cat-tarifas");
    expect(categorize({ kind: "FEE", merchantKey: "JUROS" }, context)?.categoryId).toBe("cat-tarifas");
    expect(categorize({ kind: "PAYMENT", merchantKey: "PAGAMENTO EM 08 SET" }, context)).toBeNull();
  });

  it("estorno segue a categoria do estabelecimento", () => {
    expect(categorize({ kind: "REFUND", merchantKey: merchantKeyOf("Estorno de Pastelaria do Centro") }, context)?.categoryId).toBe(
      "cat-lazer",
    );
  });
});
