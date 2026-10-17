import type { Clock, SessionRepository } from "../domain/ports";
import { hashesMatch, hashSecret, parseRefreshToken } from "../domain/tokens";

interface Deps {
  sessions: SessionRepository;
  clock: Clock;
}

export class SignOut {
  constructor(private readonly deps: Deps) {}

  /** Idempotente: token ausente, inválido ou de sessão já encerrada não é erro. */
  async execute(refreshToken: string | undefined): Promise<void> {
    const parsed = refreshToken ? parseRefreshToken(refreshToken) : null;
    if (!parsed) return;

    const session = await this.deps.sessions.findById(parsed.sessionId);
    if (!session || session.revokedAt) return;

    // Só quem tem o token (atual ou o imediatamente anterior) pode encerrar a sessão.
    const hash = hashSecret(parsed.secret);
    const owns =
      hashesMatch(hash, session.refreshTokenHash) ||
      (session.previousRefreshTokenHash !== null && hashesMatch(hash, session.previousRefreshTokenHash));
    if (owns) await this.deps.sessions.revoke(session.id, this.deps.clock());
  }
}
