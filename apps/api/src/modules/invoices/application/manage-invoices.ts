import { NotFoundError } from "../../../shared/errors";
import type { InvoiceDetail, InvoiceSummary } from "../domain/invoice";
import type { FileStorage, InvoiceRepository } from "../domain/ports";

export class ListInvoices {
  constructor(private readonly deps: { invoices: InvoiceRepository }) {}

  execute(userId: string): Promise<InvoiceSummary[]> {
    return this.deps.invoices.listByUser(userId);
  }
}

export class GetInvoice {
  constructor(private readonly deps: { invoices: InvoiceRepository }) {}

  async execute(userId: string, invoiceId: string): Promise<InvoiceDetail> {
    // Fatura de outro usuário responde igual a inexistente.
    const invoice = await this.deps.invoices.findByIdForUser(invoiceId, userId);
    if (!invoice) throw new NotFoundError("Fatura não encontrada");
    return invoice;
  }
}

export class DeleteInvoice {
  constructor(private readonly deps: { invoices: InvoiceRepository; storage: FileStorage }) {}

  async execute(userId: string, invoiceId: string): Promise<void> {
    const deleted = await this.deps.invoices.deleteForUser(invoiceId, userId);
    if (!deleted) throw new NotFoundError("Fatura não encontrada");
    if (deleted.sourceFile) await this.deps.storage.delete(deleted.sourceFile);
  }
}
