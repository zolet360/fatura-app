import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NubankInvoiceParser } from "../../src/modules/invoices/infra/parsers/nubank-invoice-parser";
import { UnpdfTextExtractor } from "../../src/modules/invoices/infra/pdf-text-extractor";

// Roda o parser contra os PDFs reais em storage/ (fora do git). Sem PDFs, o teste é pulado.
// A conferência de subtotais dentro do parser é o que garante que nada foi perdido.
const storageDir = path.resolve(import.meta.dirname, "../../../../storage");
const pdfs = (() => {
  try {
    return readdirSync(storageDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
  } catch {
    return [];
  }
})();

describe.skipIf(pdfs.length === 0)("faturas reais em storage/", () => {
  const extractor = new UnpdfTextExtractor();
  const parser = new NubankInvoiceParser();

  it.each(pdfs)("%s", async (file) => {
    const lines = await extractor.extractLines(new Uint8Array(readFileSync(path.join(storageDir, file))));
    expect(parser.matches(lines)).toBe(true);

    const invoice = parser.parse(lines);
    expect(invoice.transactions.length).toBeGreaterThan(0);
    for (const t of invoice.transactions) {
      expect(t.date.getTime()).toBeLessThanOrEqual(invoice.closingDate.getTime());
      expect(t.description).not.toBe("");
    }
  });
});
