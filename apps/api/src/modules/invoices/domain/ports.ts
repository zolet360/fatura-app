import type { CategorySource } from "../../categorization/domain/categorizer";
import type { InvoiceDetail, InvoiceSummary } from "./invoice";
import type { ParsedInvoice, ParsedTransaction, TransactionKind } from "./parsed-invoice";

export interface ClassifiedTransaction {
  merchantKey: string;
  categoryId: string | null;
  categorySource: CategorySource | null;
}

/** Classifica transações recém-lidas (implementado pelo módulo de categorização). */
export interface TransactionClassifier {
  classify(
    userId: string,
    transactions: { description: string; kind: TransactionKind }[],
  ): Promise<ClassifiedTransaction[]>;
}

export type TransactionToSave = ParsedTransaction & ClassifiedTransaction;

/** Categoria escolhida à mão numa versão anterior da fatura, para sobreviver à reimportação. */
export interface ManualCategory {
  date: Date;
  description: string;
  amountCents: number;
  categoryId: string;
}

export interface PdfLine {
  page: number;
  /** Texto da linha, com os pedaços unidos por espaço na ordem horizontal. */
  text: string;
  /** Pedaços individuais da linha, da esquerda para a direita. */
  cells: string[];
}

export interface PdfTextExtractor {
  /** Lança InvoiceParseError com código PDF_PASSWORD_PROTECTED ou PDF_UNREADABLE quando não dá para ler. */
  extractLines(pdf: Uint8Array): Promise<PdfLine[]>;
}

/** Um parser por emissor (Nubank, ...). Recebe as linhas já extraídas, sem saber de PDF. */
export interface InvoiceParser {
  readonly issuer: string;
  /** true se as linhas parecem ser de uma fatura deste emissor. */
  matches(lines: PdfLine[]): boolean;
  parse(lines: PdfLine[]): ParsedInvoice;
}

export interface InvoiceRepository {
  /**
   * Grava a fatura do usuário. Se já existir uma do mesmo emissor e mês, ela é substituída
   * por inteiro (transações antigas apagadas) numa única transação de banco.
   */
  saveImported(
    userId: string,
    invoice: Omit<ParsedInvoice, "transactions"> & { transactions: TransactionToSave[] },
    file: { key: string; hash: string },
  ): Promise<{ invoice: InvoiceSummary; replaced: boolean; previousSourceFile: string | null }>;
  findManualCategories(userId: string, issuer: string, referenceMonth: string): Promise<ManualCategory[]>;
  listByUser(userId: string): Promise<InvoiceSummary[]>;
  findByIdForUser(id: string, userId: string): Promise<InvoiceDetail | null>;
  deleteForUser(id: string, userId: string): Promise<{ sourceFile: string | null } | null>;
}

/** Guarda os PDFs originais, para auditoria e para reprocessar quando o parser melhorar. */
export interface FileStorage {
  save(key: string, content: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}
