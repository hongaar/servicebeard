import { getDb } from "@servicebeard/db";
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/server";
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

export {
    getEnabledLoginAdapters,
    getLoginAdapter,
    getPublicLoginConfig
} from "./login";
export {
    createSessionForIdentity,
    destroySession,
    getSessionCookieName,
    getSessionUser
} from "./login/session";

export async function startProviderLogin(type: string) {
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled() || !isRedirectLoginAdapter(adapter)) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }
  return adapter.startLogin();
}

export async function completeProviderLogin(
  type: string,
  params: { code: string; codeVerifier: string },
) {
  const adapter = getLoginAdapter(type);
  if (!adapter?.isEnabled() || !isRedirectLoginAdapter(adapter)) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }

  const identity = await adapter.completeLogin(params);
  return createSessionForIdentity(identity, {
    allowSignup: adapter.settings.signupEnabled,
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
  return createSessionForIdentity(identity, { allowSignup: false });
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
  return createSessionForIdentity(identity, { allowSignup: false });
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
  return createSessionForIdentity(identity, { allowSignup: false });
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
