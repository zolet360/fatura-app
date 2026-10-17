import { UnauthorizedError } from "../../../shared/errors";
import type { ClientInfo, User } from "../domain/entities";
import type {
  AccessTokenService,
  Clock,
  IdentityProvider,
  SessionRepository,
  UserRepository,
} from "../domain/ports";
import { generateInboundToken } from "../domain/tokens";
import { startSession, type IssuedTokens } from "./session-policy";

interface Deps {
  identityProvider: IdentityProvider;
  users: UserRepository;
  sessions: SessionRepository;
  accessTokens: AccessTokenService;
  clock: Clock;
}

export class SignInWithGoogle {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    code: string;
    codeVerifier: string;
    client: ClientInfo;
  }): Promise<{ user: User; tokens: IssuedTokens }> {
    const identity = await this.deps.identityProvider.exchangeCode(input.code, input.codeVerifier);
    if (!identity.emailVerified) {
      throw new UnauthorizedError("E-mail da conta Google não verificado", "EMAIL_NOT_VERIFIED");
    }

    const profile = { email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl };
    const existing = await this.deps.users.findByGoogleId(identity.providerUserId);
    const user = existing
      ? await this.deps.users.updateProfile(existing.id, profile)
      : await this.deps.users.create({
          googleId: identity.providerUserId,
          inboundToken: generateInboundToken(),
          ...profile,
        });

    const tokens = await startSession(this.deps, user.id, input.client);
    return { user, tokens };
  }
}
