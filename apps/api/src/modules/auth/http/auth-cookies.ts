import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply } from "fastify";
import { ACCESS_TOKEN_TTL_SECONDS, type IssuedTokens } from "../application/session-policy";

export const ACCESS_COOKIE = "fa_access";
export const REFRESH_COOKIE = "fa_refresh";
export const OAUTH_STATE_COOKIE = "fa_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "fa_oauth_verifier";

// httpOnly: JavaScript da página não lê os tokens (protege contra XSS roubar sessão).
// sameSite=lax: o navegador não manda os cookies em POST/DELETE vindos de outro site (CSRF).
function baseOptions(secure: boolean): CookieSerializeOptions {
  return { httpOnly: true, sameSite: "lax", secure, path: "/" };
}

export function setSessionCookies(reply: FastifyReply, tokens: IssuedTokens, secure: boolean) {
  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(secure),
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(secure),
    expires: tokens.refreshExpiresAt,
  });
}

export function clearSessionCookies(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(ACCESS_COOKIE, baseOptions(secure));
  reply.clearCookie(REFRESH_COOKIE, baseOptions(secure));
}

const OAUTH_COOKIE_PATH = "/api/auth/google";

export function setOAuthCookies(reply: FastifyReply, state: string, verifier: string, secure: boolean) {
  const options = { ...baseOptions(secure), path: OAUTH_COOKIE_PATH, maxAge: 10 * 60 };
  reply.setCookie(OAUTH_STATE_COOKIE, state, options);
  reply.setCookie(OAUTH_VERIFIER_COOKIE, verifier, options);
}

export function clearOAuthCookies(reply: FastifyReply, secure: boolean) {
  const options = { ...baseOptions(secure), path: OAUTH_COOKIE_PATH };
  reply.clearCookie(OAUTH_STATE_COOKIE, options);
  reply.clearCookie(OAUTH_VERIFIER_COOKIE, options);
}
