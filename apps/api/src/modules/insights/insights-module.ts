import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import type { InsightsDTO } from "@fatura/shared";
import type { Database } from "../../infra/database/prisma";
import { getAuth } from "../auth/http/require-auth";
import { buildInsights, type InsightInvoice } from "./domain/build-insights";

// Módulo só de leitura: o cálculo vive em domain/build-insights (puro e testado);
// aqui ficam a consulta e a rota, sem camadas extras.

export class GetInsights {
  constructor(private readonly db: Database) {}

  async execute(userId: string, month: string | null) {
    const [rows, categories] = await Promise.all([
      this.db.invoice.findMany({
        where: { userId },
        select: {
          id: true,
          referenceMonth: true,
          periodStart: true,
          periodEnd: true,
          transactions: {
            select: {
              date: true,
              description: true,
              merchantKey: true,
              amountCents: true,
              kind: true,
              categoryId: true,
              installmentCurrent: true,
              installmentTotal: true,
            },
          },
        },
      }),
      this.db.category.findMany({ select: { id: true, name: true, color: true } }),
    ]);

    const invoices: InsightInvoice[] = rows.map((invoice) => ({
      ...invoice,
      transactions: invoice.transactions.map(({ installmentCurrent, installmentTotal, ...t }) => ({
        ...t,
        installment:
          installmentCurrent !== null && installmentTotal !== null
            ? { current: installmentCurrent, total: installmentTotal }
            : null,
      })),
    }));
    return buildInsights(invoices, categories, month);
  }
}

const query = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

export async function insightsRoutes(
  app: FastifyInstance,
  opts: { requireAuth: preHandlerAsyncHookHandler; getInsights: GetInsights },
) {
  app.get("/", { preHandler: opts.requireAuth }, async (request): Promise<InsightsDTO> => {
    const { month } = query.parse(request.query);
    return opts.getInsights.execute(getAuth(request).userId, month ?? null);
  });
}
