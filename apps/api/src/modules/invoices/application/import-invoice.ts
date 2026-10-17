import { createHash } from "node:crypto";
import type { InvoiceSummary } from "../domain/invoice";
import { InvoiceParseError, referenceMonthOf, type ParsedTransaction } from "../domain/parsed-invoice";
import type { ClassifiedTransaction, FileStorage, InvoiceParser, InvoiceRepository, ManualCategory, PdfTextExtractor, TransactionClassifier, TransactionToSave } from "../domain/ports";

interface Deps {
  extractor: PdfTextExtractor;
  parsers: InvoiceParser[];
  invoices: InvoiceRepository;
  storage: FileStorage;
  classifier: TransactionClassifier;
}

const PDF_MAGIC = "%PDF-";

export class ImportInvoice {
  constructor(private readonly deps: Deps) {}

  async execute(input: { userId: string; pdf: Uint8Array }): Promise<{ invoice: InvoiceSummary; replaced: boolean }> {
    // Confere a assinatura do arquivo, não a extensão nem o Content-Type (que o cliente controla).
    if (Buffer.from(input.pdf.subarray(0, PDF_MAGIC.length)).toString("latin1") !== PDF_MAGIC) {
      throw new InvoiceParseError("O arquivo enviado não é um PDF", "NOT_A_PDF");
    }

    const lines = await this.deps.extractor.extractLines(input.pdf);
    const parser = this.deps.parsers.find((p) => p.matches(lines));
    if (!parser) {
      throw new InvoiceParseError("Fatura de banco não suportado (por enquanto só Nubank)", "UNSUPPORTED_ISSUER");
    }
    const parsed = parser.parse(lines);

    const [classified, manual] = await Promise.all([this.deps.classifier.classify(input.userId, parsed.transactions), this.deps.invoices.findManualCategories(input.userId, parsed.issuer, referenceMonthOf(parsed))]);
    const transactions = withManualCategories(
      parsed.transactions.map((t, i) => ({ ...t, ...classified[i]! })),
      manual,
    );

    // Chave pelo conteúdo: reenviar o mesmo PDF não duplica o arquivo.
    const hash = createHash("sha256").update(input.pdf).digest("hex");
    const key = `${input.userId}/${hash}.pdf`;
    await this.deps.storage.save(key, input.pdf);

    const { invoice, replaced, previousSourceFile } = await this.deps.invoices.saveImported(input.userId, { ...parsed, transactions }, { key, hash });
    if (previousSourceFile && previousSourceFile !== key) {
      await this.deps.storage.delete(previousSourceFile);
    }
    return { invoice, replaced };
  }
}

/**
 * Reaplica categorias escolhidas à mão na versão anterior da fatura. A transação é reconhecida
 * por data + descrição + valor; cada escolha manual é usada uma vez só (compras repetidas iguais
 * no mesmo dia recebem as escolhas na ordem).
 */
function withManualCategories(transactions: (ParsedTransaction & ClassifiedTransaction)[], manual: ManualCategory[]): TransactionToSave[] {
  const signature = (t: { date: Date; description: string; amountCents: number }) => `${t.date.toISOString()}|${t.description}|${t.amountCents}`;

  const pending = new Map<string, string[]>();
  for (const m of manual) pending.set(signature(m), [...(pending.get(signature(m)) ?? []), m.categoryId]);

  return transactions.map((t) => {
    const categoryId = pending.get(signature(t))?.shift();
    return categoryId ? { ...t, categoryId, categorySource: "MANUAL" } : t;
  });
}
