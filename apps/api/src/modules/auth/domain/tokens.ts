import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Refresh token = "<sessionId>.<segredo>". O id permite achar a sessão sem varrer a tabela;
// o segredo (256 bits aleatórios) é guardado só como hash SHA-256. Como o segredo já tem
// entropia alta, não precisa de hash lento (bcrypt/argon2) como uma senha precisaria.

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const [sessionId, secret, ...rest] = token.split(".");
  if (!sessionId || !secret || rest.length > 0) return null;
  return { sessionId, secret };
}

/** Token do endereço de encaminhamento: minúsculo e só alfanumérico, válido como parte local de e-mail. */
export function generateInboundToken(): string {
  return randomBytes(12).toString("hex");
}
