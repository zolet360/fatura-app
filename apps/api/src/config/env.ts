import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(),
  // Origem pública do front. A API é servida atrás dele em /api (rewrite do Next),
  // então cookies e callback do Google ficam todos na mesma origem.
  WEB_ORIGIN: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
  GOOGLE_CLIENT_ID: z.string().min(1, "configure GOOGLE_CLIENT_ID (veja README)"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "configure GOOGLE_CLIENT_SECRET (veja README)"),
  // Onde os PDFs importados ficam guardados. Relativo à pasta apps/api.
  STORAGE_DIR: z.string().default("../../storage/uploads"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas em apps/api/.env:\n${issues}`);
  }
  return parsed.data;
}
