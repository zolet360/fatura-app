// Composition root: único lugar que conhece as implementações concretas e as liga aos casos de uso.

import type { Env } from "./config/env";
import type { Database } from "./infra/database/prisma";
import { Authenticate } from "./modules/auth/application/authenticate";
import { GetCurrentUser, ListSessions, RevokeSession } from "./modules/auth/application/manage-sessions";
import { RefreshSession } from "./modules/auth/application/refresh-session";
import { ACCESS_TOKEN_TTL_SECONDS } from "./modules/auth/application/session-policy";
import { SignInWithGoogle } from "./modules/auth/application/sign-in-with-google";
import { SignOut } from "./modules/auth/application/sign-out";
import type { Clock } from "./modules/auth/domain/ports";
import { GoogleIdentityProvider } from "./modules/auth/infra/google-identity-provider";
import { JwtAccessTokenService } from "./modules/auth/infra/jwt-access-token-service";
import { PrismaSessionRepository, PrismaUserRepository } from "./modules/auth/infra/prisma-repositories";
import { LocalFileStorage } from "./infra/storage/local-file-storage";
import { GetInsights } from "./modules/insights/insights-module";
import { CategorizationService } from "./modules/categorization/application/categorization-service";
import {
  ListPendingMerchants,
  RecategorizeAll,
  SetMerchantCategory,
  SetTransactionCategory,
} from "./modules/categorization/application/use-cases";
import {
  PrismaCategoryLookup,
  PrismaCategoryRuleRepository,
  PrismaTransactionCategoryRepository,
} from "./modules/categorization/infra/prisma-categorization-repositories";
import { ImportInvoice } from "./modules/invoices/application/import-invoice";
import { DeleteInvoice, GetInvoice, ListInvoices } from "./modules/invoices/application/manage-invoices";
import { NubankInvoiceParser } from "./modules/invoices/infra/parsers/nubank-invoice-parser";
import { UnpdfTextExtractor } from "./modules/invoices/infra/pdf-text-extractor";
import { PrismaInvoiceRepository } from "./modules/invoices/infra/prisma-invoice-repository";

export function createContainer(env: Env, db: Database) {
  const clock: Clock = () => new Date();
  const users = new PrismaUserRepository(db);
  const sessions = new PrismaSessionRepository(db);
  const accessTokens = new JwtAccessTokenService(env.JWT_SECRET, ACCESS_TOKEN_TTL_SECONDS);
  const identityProvider = new GoogleIdentityProvider({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.WEB_ORIGIN}/api/auth/google/callback`,
  });
  const invoices = new PrismaInvoiceRepository(db);
  const storage = new LocalFileStorage(env.STORAGE_DIR);
  const rules = new PrismaCategoryRuleRepository(db);
  const categories = new PrismaCategoryLookup(db);
  const categorizedTransactions = new PrismaTransactionCategoryRepository(db);
  const categorization = new CategorizationService({ rules, categories });

  return {
    db,
    identityProvider,
    getInsights: new GetInsights(db),
    auth: {
      signInWithGoogle: new SignInWithGoogle({ identityProvider, users, sessions, accessTokens, clock }),
      refreshSession: new RefreshSession({ sessions, accessTokens, clock }),
      signOut: new SignOut({ sessions, clock }),
      authenticate: new Authenticate({ sessions, accessTokens, clock }),
      getCurrentUser: new GetCurrentUser({ users }),
      listSessions: new ListSessions({ sessions, clock }),
      revokeSession: new RevokeSession({ sessions, clock }),
    },
    invoices: {
      importInvoice: new ImportInvoice({
        extractor: new UnpdfTextExtractor(),
        parsers: [new NubankInvoiceParser()],
        invoices,
        storage,
        classifier: categorization,
      }),
      listInvoices: new ListInvoices({ invoices }),
      getInvoice: new GetInvoice({ invoices }),
      deleteInvoice: new DeleteInvoice({ invoices, storage }),
    },
    categorization: {
      listPendingMerchants: new ListPendingMerchants({ transactions: categorizedTransactions }),
      setMerchantCategory: new SetMerchantCategory({ rules, categories, transactions: categorizedTransactions }),
      setTransactionCategory: new SetTransactionCategory({
        rules,
        categories,
        transactions: categorizedTransactions,
        service: categorization,
      }),
      recategorizeAll: new RecategorizeAll({ transactions: categorizedTransactions, service: categorization }),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
