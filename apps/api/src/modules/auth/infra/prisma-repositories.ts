import type { Database } from "../../../infra/database/prisma";
import type { Session, User } from "../domain/entities";
import type { SessionRepository, UserRepository } from "../domain/ports";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { googleId } });
  }

  create(data: Parameters<UserRepository["create"]>[0]): Promise<User> {
    return this.db.user.create({ data });
  }

  updateProfile(id: string, data: Parameters<UserRepository["updateProfile"]>[1]): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  create(data: Parameters<SessionRepository["create"]>[0]): Promise<Session> {
    return this.db.session.create({ data });
  }

  findById(id: string): Promise<Session | null> {
    return this.db.session.findUnique({ where: { id } });
  }

  async rotate(
    id: string,
    { expectedHash, newHash, expiresAt, now }: Parameters<SessionRepository["rotate"]>[1],
  ): Promise<boolean> {
    // updateMany com o hash esperado no filtro = compare-and-swap numa única instrução SQL.
    const { count } = await this.db.session.updateMany({
      where: { id, refreshTokenHash: expectedHash, revokedAt: null },
      data: {
        refreshTokenHash: newHash,
        previousRefreshTokenHash: expectedHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt,
      },
    });
    return count === 1;
  }

  async revoke(id: string, now: Date): Promise<void> {
    await this.db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  }

  listActiveByUser(userId: string, now: Date): Promise<Session[]> {
    return this.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
    });
  }
}
