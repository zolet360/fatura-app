import { NotFoundError } from "../../../shared/errors";
import type { AuthContext, User } from "../domain/entities";
import type { Clock, SessionRepository, UserRepository } from "../domain/ports";

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
}

export class GetCurrentUser {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(auth: AuthContext): Promise<User> {
    const user = await this.deps.users.findById(auth.userId);
    if (!user) throw new NotFoundError("Usuário não encontrado");
    return user;
  }
}

export class ListSessions {
  constructor(private readonly deps: { sessions: SessionRepository; clock: Clock }) {}

  async execute(auth: AuthContext): Promise<SessionSummary[]> {
    const sessions = await this.deps.sessions.listActiveByUser(auth.userId, this.deps.clock());
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.id === auth.sessionId,
    }));
  }
}

export class RevokeSession {
  constructor(private readonly deps: { sessions: SessionRepository; clock: Clock }) {}

  async execute(auth: AuthContext, sessionId: string): Promise<void> {
    const session = await this.deps.sessions.findById(sessionId);
    // Sessão de outro usuário responde igual a inexistente, para não vazar ids.
    if (!session || session.userId !== auth.userId) throw new NotFoundError("Sessão não encontrada");
    if (!session.revokedAt) await this.deps.sessions.revoke(session.id, this.deps.clock());
  }
}
