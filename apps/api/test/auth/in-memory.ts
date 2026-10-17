import type { Session, User } from "../../src/modules/auth/domain/entities";
import type { SessionRepository, UserRepository } from "../../src/modules/auth/domain/ports";

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

export class InMemoryUserRepository implements UserRepository {
  items: User[] = [];

  async findById(id: string) {
    return this.items.find((u) => u.id === id) ?? null;
  }
  async findByGoogleId(googleId: string) {
    return this.items.find((u) => u.googleId === googleId) ?? null;
  }
  async create(data: Parameters<UserRepository["create"]>[0]) {
    const user: User = { id: nextId("user"), createdAt: new Date(), ...data };
    this.items.push(user);
    return user;
  }
  async updateProfile(id: string, data: Parameters<UserRepository["updateProfile"]>[1]) {
    const user = this.items.find((u) => u.id === id);
    if (!user) throw new Error("not found");
    Object.assign(user, data);
    return user;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  items: Session[] = [];

  async create(data: Parameters<SessionRepository["create"]>[0]) {
    const now = new Date();
    const session: Session = {
      id: nextId("session"),
      previousRefreshTokenHash: null,
      rotatedAt: null,
      createdAt: now,
      lastUsedAt: now,
      revokedAt: null,
      ...data,
    };
    this.items.push(session);
    return { ...session };
  }
  async findById(id: string) {
    const session = this.items.find((s) => s.id === id);
    return session ? { ...session } : null;
  }
  async rotate(id: string, data: Parameters<SessionRepository["rotate"]>[1]) {
    const session = this.items.find((s) => s.id === id);
    if (!session || session.revokedAt || session.refreshTokenHash !== data.expectedHash) return false;
    Object.assign(session, {
      refreshTokenHash: data.newHash,
      previousRefreshTokenHash: data.expectedHash,
      rotatedAt: data.now,
      lastUsedAt: data.now,
      expiresAt: data.expiresAt,
    });
    return true;
  }
  async revoke(id: string, now: Date) {
    const session = this.items.find((s) => s.id === id);
    if (session && !session.revokedAt) session.revokedAt = now;
  }
  async listActiveByUser(userId: string, now: Date) {
    return this.items.filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > now);
  }
}
