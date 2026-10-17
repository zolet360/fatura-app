import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import type { CategoryDTO } from "@fatura/shared";
import type { Database } from "../../infra/database/prisma";

// Módulo pequeno e só de leitura: sem casos de uso nem repositório próprios por enquanto.
// Quando ganhar regras (categorias do usuário, regras de classificação), separa em camadas como auth.

export async function categoryRoutes(
  app: FastifyInstance,
  opts: { db: Database; requireAuth: preHandlerAsyncHookHandler },
) {
  app.get("/", { preHandler: opts.requireAuth }, async (): Promise<CategoryDTO[]> => {
    return opts.db.category.findMany({
      select: { id: true, name: true, slug: true, color: true },
      orderBy: { name: "asc" },
    });
  });
}
