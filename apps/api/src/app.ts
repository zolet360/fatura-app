import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import type { ApiErrorDTO } from "@fatura/shared";
import type { Env } from "./config/env";
import type { Container } from "./container";
import { authRoutes } from "./modules/auth/http/auth-routes";
import { makeRequireAuth } from "./modules/auth/http/require-auth";
import { categoryRoutes } from "./modules/categories/category-routes";
import { categorizationRoutes } from "./modules/categorization/http/categorization-routes";
import { insightsRoutes } from "./modules/insights/insights-module";
import { invoiceRoutes } from "./modules/invoices/http/invoice-routes";
import { AppError, NotFoundError, UnauthorizedError, UnprocessableError } from "./shared/errors";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(env: Env, container: Container) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.NODE_ENV === "production" ? "info" : "debug" },
    // A API roda atrás do Next (rewrite em /api), que repassa o IP real em X-Forwarded-For.
    trustProxy: "loopback",
  });

  app.decorateRequest("auth", null);

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  // Faturas em PDF têm poucas centenas de KB; 10 MB dá folga sem abrir espaço para abuso.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });

  // Defesa extra contra CSRF além do SameSite: requisições que alteram estado vindas de navegador
  // precisam ter Origin igual ao front. Clientes sem Origin (curl, testes) passam.
  const allowedOrigin = new URL(env.WEB_ORIGIN).origin;
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (UNSAFE_METHODS.has(request.method) && origin && origin !== allowedOrigin) {
      return reply.status(403).send({ code: "FORBIDDEN_ORIGIN", message: "Origem não permitida" });
    }
  });

  app.setErrorHandler<FastifyError | Error>((error, request, reply) => {
    const send = (status: number, body: ApiErrorDTO) => reply.status(status).send(body);

    if (error instanceof UnauthorizedError) return send(401, { code: error.code, message: error.message });
    if (error instanceof NotFoundError) return send(404, { code: error.code, message: error.message });
    if (error instanceof UnprocessableError) return send(422, { code: error.code, message: error.message });
    if (error instanceof AppError) return send(400, { code: error.code, message: error.message });
    if (error instanceof ZodError) return send(400, { code: "VALIDATION_ERROR", message: "Dados inválidos" });
    if ("statusCode" in error && error.statusCode && error.statusCode < 500) {
      return send(error.statusCode, { code: error.code ?? "REQUEST_ERROR", message: error.message });
    }

    request.log.error({ err: error }, "erro não tratado");
    return send(500, { code: "INTERNAL_ERROR", message: "Erro interno" });
  });

  const requireAuth = makeRequireAuth(container.auth.authenticate);

  app.get("/api/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, {
    prefix: "/api/auth",
    webOrigin: env.WEB_ORIGIN,
    secureCookies: env.NODE_ENV === "production",
    requireAuth,
    identityProvider: container.identityProvider,
    useCases: container.auth,
  });
  await app.register(categoryRoutes, { prefix: "/api/categories", db: container.db, requireAuth });
  await app.register(invoiceRoutes, { prefix: "/api/invoices", requireAuth, useCases: container.invoices });
  await app.register(categorizationRoutes, { prefix: "/api", requireAuth, useCases: container.categorization });
  await app.register(insightsRoutes, { prefix: "/api/insights", requireAuth, getInsights: container.getInsights });

  return app;
}
