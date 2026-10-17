import "dotenv/config";
import { loadEnv } from "../src/config/env";
import { createContainer } from "../src/container";
import { createPrismaClient } from "../src/infra/database/prisma";

// Recalcula estabelecimento e categoria automática de todas as transações de todos os usuários.
// Rodar depois de mudar as regras padrão ou de uma migração que adiciona transações sem chave.
// Escolhas manuais (categoria definida pelo usuário numa transação) são preservadas.

const env = loadEnv();
const db = createPrismaClient(env.DATABASE_URL);
const { categorization } = createContainer(env, db);

try {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  for (const user of users) {
    const { changed } = await categorization.recategorizeAll.execute(user.id);
    console.log(`${user.email}: ${changed} transações atualizadas`);
  }
} finally {
  await db.$disconnect();
}
