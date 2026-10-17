import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { UnauthorizedError } from "../../../shared/errors";
import type { Authenticate } from "../application/authenticate";
import type { AuthContext } from "../domain/entities";
import { ACCESS_COOKIE } from "./auth-cookies";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

function extractAccessToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return request.cookies[ACCESS_COOKIE];
}

/** preHandler que exige usuário autenticado e preenche request.auth. */
export function makeRequireAuth(authenticate: Authenticate): preHandlerAsyncHookHandler {
  return async (request) => {
    const token = extractAccessToken(request);
    if (!token) throw new UnauthorizedError();
    request.auth = await authenticate.execute(token);
  };
}

/** Lê o contexto de um handler protegido por requireAuth. */
export function getAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth;
}
