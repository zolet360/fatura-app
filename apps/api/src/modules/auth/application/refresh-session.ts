import { UnauthorizedError } from "../../../shared/errors";
import { isSessionActive } from "../domain/entities";
import type { AccessTokenService, Clock, SessionRepository } from "../domain/ports";
import { generateSecret, hashesMatch, hashSecret, parseRefreshToken } from "../domain/tokens";
import {
  issueTokens,
  refreshExpiry,
  ROTATION_GRACE_MS,
  type IssuedTokens,
} from "./session-policy";

interface Deps {
  sessions: SessionRepository;
  accessTokens: AccessTokenService;
  clock: Clock;
}

/** Corrida entre requisições do mesmo cliente: não derruba a sessão, o cliente só tenta de novo. */
export const REFRESH_RACE = "REFRESH_RACE";
/** Token antigo reapresentado fora da janela de tolerância: provável roubo, sessão revogada. */
export const REFRESH_REUSED = "REFRESH_REUSED";

export class RefreshSession {
  constructor(private readonly deps: Deps) {}

  async execute(refreshToken: string): Promise<IssuedTokens> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw new UnauthorizedError("Refresh token inválido");

    const now = this.deps.clock();
    const session = await this.deps.sessions.findById(parsed.sessionId);
    if (!session || !isSessionActive(session, now)) {
      throw new UnauthorizedError("Sessão expirada ou encerrada", "SESSION_ENDED");
    }

    const presentedHash = hashSecret(parsed.secret);

    if (hashesMatch(presentedHash, session.refreshTokenHash)) {
      const secret = generateSecret();
      const expiresAt = refreshExpiry(now);
      const rotated = await this.deps.sessions.rotate(session.id, {
        expectedHash: session.refreshTokenHash,
        newHash: hashSecret(secret),
        expiresAt,
        now,
      });
      if (!rotated) throw new UnauthorizedError("Sessão renovada por outra requisição", REFRESH_RACE);
      return issueTokens(session, secret, expiresAt, this.deps.accessTokens);
    }

    const isPrevious =
      session.previousRefreshTokenHash !== null &&
      hashesMatch(presentedHash, session.previousRefreshTokenHash);
    const withinGrace =
      session.rotatedAt !== null && now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;

    if (isPrevious && withinGrace) {
      throw new UnauthorizedError("Sessão renovada por outra requisição", REFRESH_RACE);
    }

    await this.deps.sessions.revoke(session.id, now);
    throw new UnauthorizedError("Refresh token reutilizado; sessão encerrada", REFRESH_REUSED);
  }
}
