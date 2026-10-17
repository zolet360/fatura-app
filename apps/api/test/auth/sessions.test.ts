import { beforeEach, describe, expect, it } from "vitest";
import { Authenticate } from "../../src/modules/auth/application/authenticate";
import { RefreshSession } from "../../src/modules/auth/application/refresh-session";
import {
  REFRESH_TOKEN_TTL_MS,
  ROTATION_GRACE_MS,
  startSession,
} from "../../src/modules/auth/application/session-policy";
import { SignOut } from "../../src/modules/auth/application/sign-out";
import { JwtAccessTokenService } from "../../src/modules/auth/infra/jwt-access-token-service";
import { InMemorySessionRepository } from "./in-memory";

const client = { userAgent: "vitest", ip: "127.0.0.1" };

describe("sessões e refresh token", () => {
  let now: Date;
  let sessions: InMemorySessionRepository;
  let deps: {
    sessions: InMemorySessionRepository;
    accessTokens: JwtAccessTokenService;
    clock: () => Date;
  };
  let refresh: RefreshSession;
  let authenticate: Authenticate;

  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  beforeEach(() => {
    now = new Date("2026-10-17T12:00:00Z");
    sessions = new InMemorySessionRepository();
    deps = {
      sessions,
      accessTokens: new JwtAccessTokenService("x".repeat(32), 900),
      clock: () => now,
    };
    refresh = new RefreshSession(deps);
    authenticate = new Authenticate(deps);
  });

  it("guarda só o hash do refresh token", async () => {
    const tokens = await startSession(deps, "user_1", client);
    const stored = sessions.items[0]!;
    expect(tokens.refreshToken).toContain(stored.id);
    expect(stored.refreshTokenHash).not.toContain(tokens.refreshToken.split(".")[1]);
  });

  it("rotaciona o refresh token a cada uso", async () => {
    const first = await startSession(deps, "user_1", client);
    const second = await refresh.execute(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const third = await refresh.execute(second.refreshToken);
    expect(third.refreshToken).not.toBe(second.refreshToken);
    await expect(authenticate.execute(third.accessToken)).resolves.toMatchObject({ userId: "user_1" });
  });

  it("token anterior reapresentado logo após a rotação é corrida, não derruba a sessão", async () => {
    const first = await startSession(deps, "user_1", client);
    const second = await refresh.execute(first.refreshToken);

    advance(ROTATION_GRACE_MS - 1000);
    await expect(refresh.execute(first.refreshToken)).rejects.toMatchObject({ code: "REFRESH_RACE" });
    await expect(refresh.execute(second.refreshToken)).resolves.toBeDefined();
  });

  it("token antigo reapresentado fora da janela é tratado como roubo e encerra a sessão", async () => {
    const first = await startSession(deps, "user_1", client);
    const second = await refresh.execute(first.refreshToken);

    advance(ROTATION_GRACE_MS + 1000);
    await expect(refresh.execute(first.refreshToken)).rejects.toMatchObject({ code: "REFRESH_REUSED" });
    // Nem o dono legítimo consegue continuar: precisa logar de novo.
    await expect(refresh.execute(second.refreshToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
    await expect(authenticate.execute(second.accessToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
  });

  it("refresh token adulterado é recusado e encerra a sessão", async () => {
    const { refreshToken } = await startSession(deps, "user_1", client);
    const [sessionId] = refreshToken.split(".");
    await expect(refresh.execute(`${sessionId}.forjado`)).rejects.toMatchObject({ code: "REFRESH_REUSED" });
    await expect(refresh.execute(refreshToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
  });

  it("sessão expira se ficar sem uso além da validade", async () => {
    const { refreshToken } = await startSession(deps, "user_1", client);
    advance(REFRESH_TOKEN_TTL_MS + 1);
    await expect(refresh.execute(refreshToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
  });

  it("logout invalida access e refresh token na hora", async () => {
    const tokens = await startSession(deps, "user_1", client);
    await new SignOut(deps).execute(tokens.refreshToken);

    await expect(authenticate.execute(tokens.accessToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
    await expect(refresh.execute(tokens.refreshToken)).rejects.toMatchObject({ code: "SESSION_ENDED" });
  });

  it("access token assinado com outra chave é recusado", async () => {
    await startSession(deps, "user_1", client);
    const forged = await new JwtAccessTokenService("y".repeat(32), 900).sign({
      userId: "user_1",
      sessionId: sessions.items[0]!.id,
    });
    await expect(authenticate.execute(forged)).rejects.toMatchObject({ code: "ACCESS_TOKEN_INVALID" });
  });
});
