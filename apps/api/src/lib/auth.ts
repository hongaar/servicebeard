import { getDb, users } from "@servicebeard/db";
import type { LoginProviderType } from "@servicebeard/shared/login";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import {
  getLoginAdapter,
  isCredentialLoginAdapter,
  isRedirectLoginAdapter,
} from "./login";
import {
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from "./login/passkey";
import { createSessionForIdentity } from "./login/session";
import {
  ensureEmailVerifiedForLogin,
  issueEmailVerification,
  shouldRequireEmailVerification,
} from "./transactional-mail";

export {
  getEnabledLoginAdapters,
  getLoginAdapter,
  getPublicLoginConfig,
} from "./login";
export {
  countSignInMethods,
  isRedirectProvider,
  linkProviderToUser,
  listLinkedProviders,
  unlinkProviderFromUser,
} from "./login/providers";
export {
  createSessionForIdentity,
  destroySession,
  getSessionCookieName,
  getSessionUser,
} from "./login/session";

export async function startProviderLogin(type: string) {
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled() || !isRedirectLoginAdapter(adapter)) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }
  return adapter.startLogin();
}

export async function completeProviderIdentity(
  type: string,
  params: { code: string; codeVerifier: string },
) {
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled() || !isRedirectLoginAdapter(adapter)) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }
  return adapter.completeLogin(params);
}

export async function completeProviderLogin(
  type: string,
  params: { code: string; codeVerifier: string },
) {
  const identity = await completeProviderIdentity(type, params);
  const adapter = getLoginAdapter(type);
  return createSessionForIdentity(identity, {
    allowSignup: adapter!.settings.signupEnabled,
    provider: type as LoginProviderType,
  });
}

export async function credentialProviderLogin(
  type: string,
  credentials: {
    email: string;
    password: string;
    name?: string;
    mode: "login" | "signup";
  },
) {
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled() || !isCredentialLoginAdapter(adapter)) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }

  const identity = await adapter.login(credentials);

  if (credentials.mode === "signup" && shouldRequireEmailVerification()) {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.oidcSub, identity.externalSub),
      columns: { id: true, email: true },
    });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    await issueEmailVerification({ userId: user.id, email: user.email });
    return { requiresVerification: true as const };
  }

  const session = await createSessionForIdentity(identity, {
    allowSignup: false,
    provider: "local",
  });
  await ensureEmailVerifiedForLogin(session.user.id);
  return { requiresVerification: false as const, ...session };
}

export async function passkeyRegistrationOptions(
  type: string,
  input: { email: string; name: string },
) {
  if (type !== "local") throw new Error("LOGIN_PROVIDER_DISABLED");
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled()) throw new Error("LOGIN_PROVIDER_DISABLED");

  return createPasskeyRegistrationOptions({
    ...input,
    signupEnabled: adapter.settings.signupEnabled,
  });
}

export async function passkeyRegistrationVerify(
  type: string,
  input: { email: string; name: string; response: RegistrationResponseJSON },
) {
  if (type !== "local") throw new Error("LOGIN_PROVIDER_DISABLED");
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled()) throw new Error("LOGIN_PROVIDER_DISABLED");

  const identity = await verifyPasskeyRegistration({
    ...input,
    signupEnabled: adapter.settings.signupEnabled,
  });

  if (shouldRequireEmailVerification()) {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, identity.email),
      columns: { id: true, email: true },
    });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    await issueEmailVerification({ userId: user.id, email: user.email });
    return { requiresVerification: true as const };
  }

  const session = await createSessionForIdentity(identity, {
    allowSignup: false,
    provider: "local",
  });
  return { requiresVerification: false as const, ...session };
}

export async function passkeyAuthenticationOptions(type: string) {
  if (type !== "local") throw new Error("LOGIN_PROVIDER_DISABLED");
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled()) throw new Error("LOGIN_PROVIDER_DISABLED");

  return createPasskeyAuthenticationOptions();
}

export async function passkeyAuthenticationVerify(
  type: string,
  response: AuthenticationResponseJSON,
) {
  if (type !== "local") throw new Error("LOGIN_PROVIDER_DISABLED");
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled()) throw new Error("LOGIN_PROVIDER_DISABLED");

  const identity = await verifyPasskeyAuthentication(response);
  const session = await createSessionForIdentity(identity, {
    allowSignup: false,
    provider: "local",
  });
  await ensureEmailVerifiedForLogin(session.user.id);
  return session;
}

export async function auditLog(entry: {
  teamId?: string;
  userId?: string;
  projectId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  const { auditLog: auditLogTable } = await import("@servicebeard/db");
  await db.insert(auditLogTable).values(entry);
  logger.info({ audit: entry }, "audit event");
}
