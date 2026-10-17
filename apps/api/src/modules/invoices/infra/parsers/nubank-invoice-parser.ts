import {
  InvoiceParseError,
  type ParsedInvoice,
  type ParsedTransaction,
  type TransactionKind,
} from "../../domain/parsed-invoice";
import type { InvoiceParser, PdfLine } from "../../domain/ports";

const MONTHS: Record<string, number> = {
  JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5, JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11,
};

const DAY_MONTH = /^(\d{2}) ([A-Z]{3})$/;
const DAY_MONTH_YEAR = /(\d{2}) ([A-Z]{3}) (\d{4})/;
// Nubank usa tanto hífen quanto o sinal de menos tipográfico (U+2212) em valores negativos.
const MONEY = /^([-−])?R\$ ([\d.]+),(\d{2})$/;
const CARD = /^•+ ?(\d{4})$/;
const INSTALLMENT = /^(.*?) - Parcela (\d+)\/(\d+)$/;
const FOREIGN_AMOUNT = /^BRL [\d.]+ = ([A-Z]{3}) (\d+)\.(\d{2})$/;
const CONVERSION = /^Conversão:/;

export function parseMoney(text: string): number | null {
  const match = MONEY.exec(text.trim());
  if (!match) return null;
  const [, sign, integer, decimals] = match;
  const cents = Number(integer!.replaceAll(".", "")) * 100 + Number(decimals);
  return sign ? -cents : cents;
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function parseFullDate(text: string): Date | null {
  const match = DAY_MONTH_YEAR.exec(text);
  if (!match) return null;
  const month = MONTHS[match[2]!];
  return month === undefined ? null : utcDate(Number(match[3]), month, Number(match[1]));
}

/**
 * Datas das transações vêm sem ano ("16 SET"). Como todas são anteriores ao fechamento,
 * um mês maior que o do fechamento só pode ser do ano anterior (fatura que vira o ano).
 */
function inferDate(day: number, month: number, closing: Date): Date {
  const year = month > closing.getUTCMonth() ? closing.getUTCFullYear() - 1 : closing.getUTCFullYear();
  return utcDate(year, month, day);
}

function parseDayMonth(text: string, closing: Date): Date | null {
  const match = DAY_MONTH.exec(text);
  const month = match ? MONTHS[match[2]!] : undefined;
  return match && month !== undefined ? inferDate(Number(match[1]), month, closing) : null;
}

function classify(description: string, amountCents: number, inPaymentsGroup: boolean): TransactionKind {
  if (inPaymentsGroup) return "PAYMENT";
  if (/^IOF\b/i.test(description)) return "IOF";
  if (/^(juros|multa|encargos|mora)\b/i.test(description)) return "FEE";
  if (amountCents < 0) return "REFUND";
  return "PURCHASE";
}

interface Group {
  name: string;
  expectedCents: number;
  transactions: ParsedTransaction[];
}

export class NubankInvoiceParser implements InvoiceParser {
  readonly issuer = "nubank";

  matches(lines: PdfLine[]): boolean {
    const text = lines.map((l) => l.text).join("\n");
    return text.includes("Nu Pagamentos S.A.") && text.includes("EMISSÃO E ENVIO");
  }

  parse(lines: PdfLine[]): ParsedInvoice {
    const header = this.parseHeader(lines);
    const groups = this.parseTransactions(lines, header.closingDate);

    if (groups.length === 0) {
      throw new InvoiceParseError("Nenhuma transação encontrada na fatura");
    }
    // Conferência: a soma das linhas de cada grupo tem que bater, centavo por centavo, com o
    // subtotal impresso. Se uma linha não foi reconhecida, a importação falha em vez de salvar errado.
    for (const group of groups) {
      const sum = group.transactions.reduce((acc, t) => acc + t.amountCents, 0);
      if (sum !== group.expectedCents) {
        throw new InvoiceParseError(
          `Soma das transações de "${group.name}" (${sum}) não confere com o subtotal da fatura (${group.expectedCents})`,
          "INVOICE_CHECKSUM_MISMATCH",
        );
      }
    }

    return { issuer: this.issuer, ...header, transactions: groups.flatMap((g) => g.transactions) };
  }

  private parseHeader(lines: PdfLine[]) {
    let dueDate: Date | null = null;
    let closingDate: Date | null = null;
    let totalCents: number | null = null;
    let period: string | null = null;

    for (const line of lines) {
      for (const cell of line.cells) {
        if (!dueDate && cell.startsWith("FATURA ")) dueDate = parseFullDate(cell);
        if (!closingDate && cell.startsWith("EMISSÃO E ENVIO ")) closingDate = parseFullDate(cell);
        if (!period && /^DE \d{2} [A-Z]{3} A \d{2} [A-Z]{3}$/.test(cell)) period = cell;
      }
      if (!dueDate && line.text.startsWith("Data de vencimento:")) dueDate = parseFullDate(line.text);
      if (totalCents === null && line.cells[0] === "Total a pagar" && line.cells.length === 2) {
        totalCents = parseMoney(line.cells[1]!);
      }
    }

    if (!dueDate) throw new InvoiceParseError("Data de vencimento não encontrada");
    if (!closingDate) throw new InvoiceParseError("Data de fechamento (emissão) não encontrada");
    if (totalCents === null) throw new InvoiceParseError("Total a pagar não encontrado");

    const periodMatch = period ? /^DE (\d{2} [A-Z]{3}) A (\d{2} [A-Z]{3})$/.exec(period) : null;
    const periodStart = periodMatch ? parseDayMonth(periodMatch[1]!, closingDate) : null;
    const periodEnd = periodMatch ? parseDayMonth(periodMatch[2]!, closingDate) : null;
    if (!periodStart || !periodEnd) throw new InvoiceParseError("Período da fatura não encontrado");

    return { dueDate, closingDate, totalCents, periodStart, periodEnd };
  }

  private parseTransactions(lines: PdfLine[], closingDate: Date): Group[] {
    const groups: Group[] = [];
    let inSection = false;
    let current: Group | null = null;
    let last: ParsedTransaction | null = null;

    for (const { cells, text } of lines) {
      const first = cells[0] ?? "";

      // Cabeçalho de seção se repete no topo de cada página de transações.
      if (first === "TRANSAÇÕES" || /^TRANSAÇÕES DE /.test(text)) {
        inSection = true;
        continue;
      }
      if (!inSection) continue;

      const date = parseDayMonth(first, closingDate);
      const amountCents = cells.length >= 2 ? parseMoney(cells.at(-1)!) : null;

      if (date && amountCents !== null) {
        if (!current) throw new InvoiceParseError("Transação encontrada antes do primeiro grupo de cartão");
        // Linhas informativas de valor zero (ex: "Saldo restante da fatura anterior R$ 0,00") não são
        // lançamentos. Não alteram a conferência de subtotais.
        if (amountCents === 0) {
          last = null;
          continue;
        }
        const middle = cells.slice(1, -1);
        const cardLast4 = middle[0] ? (CARD.exec(middle[0])?.[1] ?? null) : null;
        const rawDescription = (cardLast4 ? middle.slice(1) : middle).join(" ").trim();
        const installmentMatch = INSTALLMENT.exec(rawDescription);
        const description = installmentMatch ? installmentMatch[1]!.trim() : rawDescription;

        last = {
          date,
          description,
          amountCents,
          kind: classify(description, amountCents, /^pagamentos?\b/i.test(current.name)),
          cardLast4,
          installment: installmentMatch
            ? { current: Number(installmentMatch[2]), total: Number(installmentMatch[3]) }
            : null,
          foreign: null,
        };
        current.transactions.push(last);
        continue;
      }

      // Linha de grupo: "<titular ou Pagamentos>  R$ subtotal", sem data na frente.
      if (cells.length === 2 && amountCents !== null && !date) {
        current = { name: first, expectedCents: amountCents, transactions: [] };
        groups.push(current);
        last = null;
        continue;
      }

      // Detalhes de compra internacional, na(s) linha(s) logo abaixo da transação.
      const foreign = FOREIGN_AMOUNT.exec(text);
      if (foreign && last) {
        last.foreign = { currency: foreign[1]!, amountCents: Number(foreign[2]) * 100 + Number(foreign[3]) };
        continue;
      }
      if (CONVERSION.test(text)) continue;

      // Demais linhas (rodapé, número de página, avisos legais) são ignoradas; qualquer transação
      // que tenha caído aqui por engano é pega pela conferência de subtotais.
    }

    return groups;
  }
}
