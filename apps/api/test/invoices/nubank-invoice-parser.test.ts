import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../src/modules/invoices/domain/ports";
import { NubankInvoiceParser, parseMoney } from "../../src/modules/invoices/infra/parsers/nubank-invoice-parser";

// Linhas sintéticas no formato que o extrator produz a partir do PDF da Nubank (dados fictícios).
function line(page: number, ...cells: string[]): PdfLine {
  return { page, cells, text: cells.join(" ") };
}

function header(page: number, due = "13 JAN 2027", closing = "04 JAN 2027") {
  return [line(page, "MARIA DA SILVA"), line(page, `FATURA ${due}`, `EMISSÃO E ENVIO ${closing}`)];
}

function invoiceLines(overrides: { holderTotal?: string } = {}): PdfLine[] {
  return [
    line(1, "Data de vencimento: 13 JAN 2027"),
    ...header(4),
    line(4, "Total a pagar", "R$ 1.234,56"),
    ...header(5),
    line(5, "TRANSAÇÕES", "DE 04 DEZ A 04 JAN"),
    line(5, "Maria da Silva", overrides.holderTotal ?? "R$ 1.144,56"),
    line(5, "05 DEZ", "•••• 1111", "Mercado Central", "R$ 1.000,00"),
    line(5, "10 DEZ", "•••• 1111", "Loja X - Parcela 3/12", "R$ 100,00"),
    line(5, "15 DEZ", "IOF de \"Steam\"", "R$ 1,56"),
    line(5, "15 DEZ", "•••• 1111", "Steam", "R$ 43,00"),
    line(5, "BRL 43.00 = USD 8.00"),
    line(5, "Conversão: BRL 5.37 = USD 1 = R$ 5,37"),
    line(5, "5 de 6"),
    ...header(6),
    line(6, "TRANSAÇÕES", "DE 04 DEZ A 04 JAN"),
    line(6, "20 DEZ", "•••• 1111", "Estorno de Mercado Central", "−R$ 50,00"),
    line(6, "02 JAN", "•••• 1111", "Padaria", "R$ 30,00"),
    line(6, "03 JAN", "Juros de atraso", "R$ 20,00"),
    line(6, "João da Silva", "R$ 90,00"),
    line(6, "28 DEZ", "•••• 2222", "Posto", "R$ 90,00"),
    line(6, "Pagamentos e Financiamentos", "-R$ 500,00"),
    line(6, "08 DEZ", "Pagamento em 08 DEZ", "−R$ 500,00"),
    line(6, "11 DEZ", "Saldo restante da fatura anterior", "R$ 0,00"),
    line(6, "11 DEZ", "Saldo restante da fatura anterior", "R$ 0,00"),
    line(6, "Em cumprimento à regulação do Banco Central, as suas operações de crédito..."),
    line(6, "Nu Pagamentos S.A."),
  ];
}

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("NubankInvoiceParser", () => {
  const parser = new NubankInvoiceParser();

  it("reconhece fatura Nubank", () => {
    expect(parser.matches(invoiceLines())).toBe(true);
    expect(parser.matches([line(1, "Banco Qualquer"), line(1, "Fatura do cartão")])).toBe(false);
  });

  it("lê cabeçalho, inferindo o ano em fatura que atravessa a virada do ano", () => {
    const invoice = parser.parse(invoiceLines());
    expect(day(invoice.dueDate)).toBe("2027-01-13");
    expect(day(invoice.closingDate)).toBe("2027-01-04");
    expect(day(invoice.periodStart)).toBe("2026-12-04");
    expect(day(invoice.periodEnd)).toBe("2027-01-04");
    expect(invoice.totalCents).toBe(123456);
  });

  it("lê todas as transações, em ordem, de todos os titulares", () => {
    const { transactions } = parser.parse(invoiceLines());
    expect(transactions.map((t) => [day(t.date), t.description, t.amountCents, t.kind])).toEqual([
      ["2026-12-05", "Mercado Central", 100000, "PURCHASE"],
      ["2026-12-10", "Loja X", 10000, "PURCHASE"],
      ["2026-12-15", 'IOF de "Steam"', 156, "IOF"],
      ["2026-12-15", "Steam", 4300, "PURCHASE"],
      ["2026-12-20", "Estorno de Mercado Central", -5000, "REFUND"],
      ["2027-01-02", "Padaria", 3000, "PURCHASE"],
      ["2027-01-03", "Juros de atraso", 2000, "FEE"],
      ["2026-12-28", "Posto", 9000, "PURCHASE"],
      ["2026-12-08", "Pagamento em 08 DEZ", -50000, "PAYMENT"],
    ]);
  });

  it("ignora linhas informativas de valor zero", () => {
    const { transactions } = parser.parse(invoiceLines());
    expect(transactions.some((t) => t.description.startsWith("Saldo restante"))).toBe(false);
    expect(transactions.every((t) => t.amountCents !== 0)).toBe(true);
  });

  it("separa parcela, cartão e valor em moeda estrangeira", () => {
    const { transactions } = parser.parse(invoiceLines());
    const byName = (name: string) => transactions.find((t) => t.description === name)!;

    expect(byName("Loja X").installment).toEqual({ current: 3, total: 12 });
    expect(byName("Steam").foreign).toEqual({ currency: "USD", amountCents: 800 });
    expect(byName("Posto").cardLast4).toBe("2222");
    expect(byName('IOF de "Steam"').cardLast4).toBeNull();
  });

  it("recusa a fatura quando a soma das linhas não bate com o subtotal impresso", () => {
    expect(() => parser.parse(invoiceLines({ holderTotal: "R$ 1.144,57" }))).toThrow(
      expect.objectContaining({ code: "INVOICE_CHECKSUM_MISMATCH" }),
    );
  });

  it("recusa a fatura quando uma transação não foi reconhecida", () => {
    const lines = invoiceLines().filter((l) => !l.text.includes("Padaria"));
    lines.splice(15, 0, line(6, "02 JAN", "•••• 1111", "Padaria", "valor ilegível"));
    expect(() => parser.parse(lines)).toThrow(expect.objectContaining({ code: "INVOICE_CHECKSUM_MISMATCH" }));
  });

  it("exige vencimento, fechamento e total", () => {
    const withoutTotal = invoiceLines().filter((l) => l.cells[0] !== "Total a pagar");
    expect(() => parser.parse(withoutTotal)).toThrow(/Total a pagar/);
  });
});

describe("parseMoney", () => {
  it.each([
    ["R$ 1,77", 177],
    ["R$ 1.903,03", 190303],
    ["R$ 12.345.678,90", 1234567890],
    ["-R$ 1.623,66", -162366],
    ["−R$ 1.623,66", -162366],
  ])("%s → %i centavos", (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it("rejeita o que não é valor", () => {
    expect(parseMoney("1.903,03")).toBeNull();
    expect(parseMoney("R$ 10")).toBeNull();
  });
});
