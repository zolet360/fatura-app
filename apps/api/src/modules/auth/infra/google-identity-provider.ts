import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { UnauthorizedError } from "../../../shared/errors";
import type { ExternalIdentity } from "../domain/entities";
import type { IdentityProvider } from "../domain/ports";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** OAuth 2.0 Authorization Code + PKCE com o Google, só para identificar o usuário (OpenID Connect). */
export class GoogleIdentityProvider implements IdentityProvider {
  constructor(
    private readonly config: { clientId: string; clientSecret: string; redirectUri: string },
  ) {}

  createAuthorizationUrl(state: string, codeVerifier: string): URL {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<ExternalIdentity> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      throw new UnauthorizedError("O Google recusou o código de autorização", "OAUTH_EXCHANGE_FAILED");
    }

    const body = (await response.json()) as { id_token?: unknown };
    if (typeof body.id_token !== "string") {
      throw new UnauthorizedError("Resposta do Google sem id_token", "OAUTH_EXCHANGE_FAILED");
    }

    // Verifica assinatura, emissor, audiência e validade do id_token com as chaves públicas do Google.
    const { payload } = await jwtVerify(body.id_token, googleKeys, {
      issuer: GOOGLE_ISSUERS,
      audience: this.config.clientId,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      throw new UnauthorizedError("id_token do Google sem e-mail", "OAUTH_EXCHANGE_FAILED");
    }

    return {
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : null,
      avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
    };
  }
}
