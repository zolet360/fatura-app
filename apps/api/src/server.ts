import { buildApp } from "./app";
import { loadEnv } from "./config/env";
import { createContainer } from "./container";
import { createPrismaClient } from "./infra/database/prisma";

const env = loadEnv();
const db = createPrismaClient(env.DATABASE_URL);
const app = await buildApp(env, createContainer(env, db));

async function shutdown(signal: string) {
  app.log.info(`${signal} recebido, encerrando`);
  await app.close();
  await db.$disconnect();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

// Só em localhost: em produção a API fica atrás do front/proxy, nunca exposta direto.
await app.listen({ port: env.PORT, host: env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1" });
