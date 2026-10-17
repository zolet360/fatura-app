export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  inboundToken: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}

/** Identidade devolvida pelo provedor de login (Google) depois do OAuth. */
export interface ExternalIdentity {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

/** Quem está fazendo a requisição autenticada. */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}
