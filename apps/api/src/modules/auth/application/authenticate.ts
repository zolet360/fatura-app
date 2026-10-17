import { UnauthorizedError } from "../../../shared/errors";
import { isSessionActive, type AuthContext } from "../domain/entities";
import type { AccessTokenService, Clock, SessionRepository } from "../domain/ports";

interface Deps {
  sessions: SessionRepository;
  accessTokens: AccessTokenService;
  clock: Clock;
}

/**
 * Valida o access token e confere a sessão no banco. A consulta extra faz com que
 * encerrar uma sessão (logout, "sair dos outros dispositivos") valha na hora,
 * sem esperar o access token expirar.
 */
export class Authenticate {
  constructor(private readonly deps: Deps) {}

  async execute(accessToken: string): Promise<AuthContext> {
    const context = await this.deps.accessTokens.verify(accessToken);
    if (!context) throw new UnauthorizedError("Access token inválido ou expirado", "ACCESS_TOKEN_INVALID");

    const session = await this.deps.sessions.findById(context.sessionId);
    if (!session || session.userId !== context.userId || !isSessionActive(session, this.deps.clock())) {
      throw new UnauthorizedError("Sessão expirada ou encerrada", "SESSION_ENDED");
    }
    return context;
  }
}
