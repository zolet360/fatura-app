import { getDocumentProxy } from "unpdf";
import { InvoiceParseError } from "../domain/parsed-invoice";
import type { PdfLine, PdfTextExtractor } from "../domain/ports";

async function openDocument(pdf: Uint8Array) {
  try {
    // pdf.js pode transferir (esvaziar) o buffer recebido; passamos uma cópia.
    return await getDocumentProxy(pdf.slice());
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      throw new InvoiceParseError("O PDF está protegido por senha", "PDF_PASSWORD_PROTECTED");
    }
    throw new InvoiceParseError("Não foi possível ler o PDF", "PDF_UNREADABLE");
  }
}

/** Distância vertical (em pontos) até a qual dois pedaços de texto contam como a mesma linha. */
const SAME_LINE_TOLERANCE = 2;

/**
 * Extrai o texto do PDF reconstruindo as linhas visuais: o PDF guarda pedaços de texto soltos
 * com coordenadas, então agrupamos por Y e ordenamos por X. Assim o valor de uma transação,
 * que fica na mesma altura da descrição, volta a ficar na mesma linha dela.
 */
export class UnpdfTextExtractor implements PdfTextExtractor {
  async extractLines(pdf: Uint8Array): Promise<PdfLine[]> {
    const document = await openDocument(pdf);
    const lines: PdfLine[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows: { y: number; cells: { x: number; text: string }[] }[] = [];

      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const x = item.transform[4] as number;
        const y = item.transform[5] as number;
        let row = rows.find((r) => Math.abs(r.y - y) <= SAME_LINE_TOLERANCE);
        if (!row) {
          row = { y, cells: [] };
          rows.push(row);
        }
        row.cells.push({ x, text: item.str.trim() });
      }

      // Y do PDF cresce de baixo para cima: ordem de leitura é Y decrescente.
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) {
        const cells = row.cells.sort((a, b) => a.x - b.x).map((c) => c.text);
        lines.push({ page: pageNumber, text: cells.join(" ").replace(/\s+/g, " "), cells });
      }
    }

    return lines;
  }
}
