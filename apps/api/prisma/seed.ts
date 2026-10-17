import "dotenv/config";
import { createPrismaClient } from "../src/infra/database/prisma";

// Categorias padrão. Idempotente: pode rodar várias vezes (upsert pelo slug).
const categories = [
  { slug: "alimentacao", name: "Alimentação", color: "#f97316" },
  { slug: "mercado", name: "Mercado", color: "#84cc16" },
  { slug: "transporte", name: "Transporte", color: "#0ea5e9" },
  { slug: "saude", name: "Saúde", color: "#ef4444" },
  { slug: "assinaturas", name: "Assinaturas", color: "#8b5cf6" },
  { slug: "compras", name: "Compras", color: "#ec4899" },
  { slug: "lazer", name: "Lazer", color: "#eab308" },
  { slug: "educacao", name: "Educação", color: "#14b8a6" },
  { slug: "casa", name: "Casa", color: "#a16207" },
  { slug: "viagem", name: "Viagem", color: "#6366f1" },
  { slug: "servicos", name: "Serviços", color: "#64748b" },
  { slug: "tarifas", name: "Tarifas e juros", color: "#b91c1c" },
  { slug: "presentes", name: "Presentes", color: "#d946ef" },
  { slug: "outros", name: "Outros", color: "#9ca3af" },
];

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL não definida");

const db = createPrismaClient(databaseUrl);
try {
  for (const { slug, ...data } of categories) {
    await db.category.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  }
  console.log(`${categories.length} categorias garantidas.`);
} finally {
  await db.$disconnect();
}
