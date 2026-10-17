import type { AuthContext, ExternalIdentity, Session, User } from "./entities";

// Contratos que a camada de aplicação usa. Implementações ficam em ../infra.

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  create(data: {
    googleId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    inboundToken: string;
  }): Promise<User>;
  updateProfile(
    id: string,
    data: { email: string; name: string | null; avatarUrl: string | null },
  ): Promise<User>;
}

export interface SessionRepository {
  create(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ip: string | null;
    expiresAt: Date;
  }): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  /**
   * Troca o hash do refresh token de forma atômica (compare-and-swap):
   * só atualiza se o hash atual ainda for `expectedHash` e a sessão não estiver revogada.
   * Retorna false se outra requisição rotacionou primeiro.
   */
  rotate(
    id: string,
    data: { expectedHash: string; newHash: string; expiresAt: Date; now: Date },
  ): Promise<boolean>;
  revoke(id: string, now: Date): Promise<void>;
  listActiveByUser(userId: string, now: Date): Promise<Session[]>;
}

export interface AccessTokenService {
  sign(context: AuthContext): Promise<string>;
  /** Retorna null para token inválido, adulterado ou expirado. */
  verify(token: string): Promise<AuthContext | null>;
}

export interface IdentityProvider {
  createAuthorizationUrl(state: string, codeVerifier: string): URL;
  exchangeCode(code: string, codeVerifier: string): Promise<ExternalIdentity>;
}

export type Clock = () => Date;
