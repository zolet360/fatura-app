import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import {
  setMerchantCategorySchema,
  setTransactionCategorySchema,
  type PendingMerchantDTO,
  type TransactionCategoryDTO,
} from "@fatura/shared";
import { getAuth } from "../../auth/http/require-auth";
import type {
  ListPendingMerchants,
  RecategorizeAll,
  SetMerchantCategory,
  SetTransactionCategory,
} from "../application/use-cases";

export interface CategorizationRoutesOptions {
  requireAuth: preHandlerAsyncHookHandler;
  useCases: {
    listPendingMerchants: ListPendingMerchants;
    setMerchantCategory: SetMerchantCategory;
    setTransactionCategory: SetTransactionCategory;
    recategorizeAll: RecategorizeAll;
  };
}

export async function categorizationRoutes(app: FastifyInstance, opts: CategorizationRoutesOptions) {
  const { useCases } = opts;
  app.addHook("preHandler", opts.requireAuth);

  app.get("/categorization/pending", async (request): Promise<PendingMerchantDTO[]> => {
    const pending = await useCases.listPendingMerchants.execute(getAuth(request).userId);
    return pending.map((p) => ({ ...p, lastDate: p.lastDate.toISOString().slice(0, 10) }));
  });

  // Regra "sempre": vale para todas as transações do estabelecimento, passadas e futuras.
  app.post("/categorization/rules", async (request) => {
    const { merchantKey, categoryId } = setMerchantCategorySchema.parse(request.body);
    return useCases.setMerchantCategory.execute(getAuth(request).userId, merchantKey, categoryId);
  });

  app.post("/categorization/recompute", async (request) => {
    return useCases.recategorizeAll.execute(getAuth(request).userId);
  });

  // Exceção: categoria só desta transação.
  app.patch("/transactions/:id/category", async (request): Promise<TransactionCategoryDTO> => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { categoryId } = setTransactionCategorySchema.parse(request.body);
    const change = await useCases.setTransactionCategory.execute(getAuth(request).userId, id, categoryId);
    return { categoryId: change.categoryId, categorySource: change.source };
  });
}
