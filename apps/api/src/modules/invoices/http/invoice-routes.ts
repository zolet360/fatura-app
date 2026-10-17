import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import type { ImportInvoiceResultDTO, InvoiceDetailDTO, InvoiceSummaryDTO } from "@fatura/shared";
import { AppError } from "../../../shared/errors";
import { getAuth } from "../../auth/http/require-auth";
import type { ImportInvoice } from "../application/import-invoice";
import type { DeleteInvoice, GetInvoice, ListInvoices } from "../application/manage-invoices";
import type { InvoiceDetail, InvoiceSummary } from "../domain/invoice";

export interface InvoiceRoutesOptions {
  requireAuth: preHandlerAsyncHookHandler;
  useCases: {
    importInvoice: ImportInvoice;
    listInvoices: ListInvoices;
    getInvoice: GetInvoice;
    deleteInvoice: DeleteInvoice;
  };
}

const day = (date: Date) => date.toISOString().slice(0, 10);

function toSummaryDTO(invoice: InvoiceSummary): InvoiceSummaryDTO {
  return {
    id: invoice.id,
    issuer: invoice.issuer,
    referenceMonth: invoice.referenceMonth,
    dueDate: day(invoice.dueDate),
    closingDate: day(invoice.closingDate),
    periodStart: day(invoice.periodStart),
    periodEnd: day(invoice.periodEnd),
    totalCents: invoice.totalCents,
    spentCents: invoice.spentCents,
    transactionCount: invoice.transactionCount,
    importedAt: invoice.importedAt.toISOString(),
  };
}

function toDetailDTO(invoice: InvoiceDetail): InvoiceDetailDTO {
  return {
    ...toSummaryDTO(invoice),
    transactions: invoice.transactions.map((t) => ({ ...t, date: day(t.date) })),
  };
}

const idParams = z.object({ id: z.string().min(1) });

export async function invoiceRoutes(app: FastifyInstance, opts: InvoiceRoutesOptions) {
  const { useCases, requireAuth } = opts;
  app.addHook("preHandler", requireAuth);

  app.post(
    "/import",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request): Promise<ImportInvoiceResultDTO> => {
      const file = await request.file();
      if (!file) throw new AppError("Envie o PDF da fatura no campo 'file'", "FILE_REQUIRED");
      const pdf = new Uint8Array(await file.toBuffer());
      const result = await useCases.importInvoice.execute({ userId: getAuth(request).userId, pdf });
      return { invoice: toSummaryDTO(result.invoice), replaced: result.replaced };
    },
  );

  app.get("/", async (request): Promise<InvoiceSummaryDTO[]> => {
    const invoices = await useCases.listInvoices.execute(getAuth(request).userId);
    return invoices.map(toSummaryDTO);
  });

  app.get("/:id", async (request): Promise<InvoiceDetailDTO> => {
    const { id } = idParams.parse(request.params);
    return toDetailDTO(await useCases.getInvoice.execute(getAuth(request).userId, id));
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await useCases.deleteInvoice.execute(getAuth(request).userId, id);
    return reply.status(204).send();
  });
}
