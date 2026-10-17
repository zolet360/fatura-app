import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import type { SessionDTO, UserDTO } from "@fatura/shared";
import { AppError, UnauthorizedError } from "../../../shared/errors";
import type { Authenticate } from "../application/authenticate";
import type { GetCurrentUser, ListSessions, RevokeSession } from "../application/manage-sessions";
import { REFRESH_RACE, type RefreshSession } from "../application/refresh-session";
import type { SignInWithGoogle } from "../application/sign-in-with-google";
import type { SignOut } from "../application/sign-out";
import type { ClientInfo } from "../domain/entities";
import type { IdentityProvider } from "../domain/ports";
import { generateSecret } from "../domain/tokens";
import {
  clearOAuthCookies,
  clearSessionCookies,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
  setOAuthCookies,
  setSessionCookies,
} from "./auth-cookies";
import { getAuth } from "./require-auth";

export interface AuthRoutesOptions {
  webOrigin: string;
  secureCookies: boolean;
  requireAuth: preHandlerAsyncHookHandler;
  identityProvider: IdentityProvider;
  useCases: {
    signInWithGoogle: SignInWithGoogle;
    refreshSession: RefreshSession;
    signOut: SignOut;
    authenticate: Authenticate;
    getCurrentUser: GetCurrentUser;
    listSessions: ListSessions;
    revokeSession: RevokeSession;
  };
}

const strictLimit = { rateLimit: { max: 20, timeWindow: "1 minute" } };

const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

function clientInfo(request: FastifyRequest): ClientInfo {
  return { userAgent: request.headers["user-agent"]?.slice(0, 512) ?? null, ip: request.ip };
}

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions) {
  const { useCases, secureCookies, requireAuth } = opts;
  const loginUrl = (error: string) => `${opts.webOrigin}/login?error=${encodeURIComponent(error)}`;

  app.get("/google", { config: strictLimit }, async (_request, reply) => {
    const state = generateSecret();
    const verifier = generateSecret();
    setOAuthCookies(reply, state, verifier, secureCookies);
    return reply.redirect(opts.identityProvider.createAuthorizationUrl(state, verifier).toString());
  });

  app.get("/google/callback", { config: strictLimit }, async (request, reply) => {
    const query = callbackQuery.parse(request.query);
    const expectedState = request.cookies[OAUTH_STATE_COOKIE];
    const verifier = request.cookies[OAUTH_VERIFIER_COOKIE];
    clearOAuthCookies(reply, secureCookies);

    // Usuário cancelou na tela do Google.
    if (query.error) return reply.redirect(loginUrl("cancelled"));
    // state confere com o cookie: garante que o login foi iniciado por este navegador (anti-CSRF).
    if (!query.code || !query.state || !expectedState || !verifier || query.state !== expectedState) {
      return reply.redirect(loginUrl("invalid_state"));
    }

    try {
      const { tokens } = await useCases.signInWithGoogle.execute({
        code: query.code,
        codeVerifier: verifier,
        client: clientInfo(request),
      });
      setSessionCookies(reply, tokens, secureCookies);
      return reply.redirect(`${opts.webOrigin}/`);
    } catch (error) {
      request.log.warn({ err: error }, "falha no login com Google");
      const code = error instanceof AppError ? error.code.toLowerCase() : "unexpected";
      return reply.redirect(loginUrl(code));
    }
  });

  app.post("/refresh", { config: strictLimit }, async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedError("Sem sessão", "NO_SESSION");
    try {
      const tokens = await useCases.refreshSession.execute(refreshToken);
      setSessionCookies(reply, tokens, secureCookies);
      return reply.status(204).send();
    } catch (error) {
      // Em corrida, os cookies novos já foram gravados pela outra requisição: não apagar.
      if (!(error instanceof AppError && error.code === REFRESH_RACE)) {
        clearSessionCookies(reply, secureCookies);
      }
      throw error;
    }
  });

  app.post("/logout", async (request, reply) => {
    await useCases.signOut.execute(request.cookies[REFRESH_COOKIE]);
    clearSessionCookies(reply, secureCookies);
    return reply.status(204).send();
  });

  app.get("/me", { preHandler: requireAuth }, async (request): Promise<UserDTO> => {
    const user = await useCases.getCurrentUser.execute(getAuth(request));
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  });

  app.get("/sessions", { preHandler: requireAuth }, async (request): Promise<SessionDTO[]> => {
    const sessions = await useCases.listSessions.execute(getAuth(request));
    return sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
    }));
  });

  app.delete("/sessions/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const auth = getAuth(request);
    await useCases.revokeSession.execute(auth, id);
    if (id === auth.sessionId) clearSessionCookies(reply, secureCookies);
    return reply.status(204).send();
  });
}
