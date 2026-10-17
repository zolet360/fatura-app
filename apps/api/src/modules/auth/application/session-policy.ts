import type { Session } from "../domain/entities";
import type { AccessTokenService, Clock, SessionRepository } from "../domain/ports";
import { formatRefreshToken, generateSecret, hashSecret } from "../domain/tokens";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Validade deslizante: cada refresh empurra o vencimento para frente. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Janela em que reapresentar o token ANTERIOR é tratado como corrida (duas abas renovando
 * ao mesmo tempo) e não como roubo. Fora dela, reuso derruba a sessão.
 */
export const ROTATION_GRACE_MS = 30 * 1000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function refreshExpiry(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}

export async function issueTokens(
  session: Pick<Session, "id" | "userId">,
  secret: string,
  refreshExpiresAt: Date,
  accessTokens: AccessTokenService,
): Promise<IssuedTokens> {
  return {
    accessToken: await accessTokens.sign({ userId: session.userId, sessionId: session.id }),
    refreshToken: formatRefreshToken(session.id, secret),
    refreshExpiresAt,
  };
}

export async function startSession(
  deps: { sessions: SessionRepository; accessTokens: AccessTokenService; clock: Clock },
  userId: string,
  client: { userAgent: string | null; ip: string | null },
): Promise<IssuedTokens> {
  const secret = generateSecret();
  const expiresAt = refreshExpiry(deps.clock());
  const session = await deps.sessions.create({
    userId,
    refreshTokenHash: hashSecret(secret),
    userAgent: client.userAgent,
    ip: client.ip,
    expiresAt,
  });
  return issueTokens(session, secret, expiresAt, deps.accessTokens);
}
