import {
  getDb,
  users,
  webauthnChallenges,
  webauthnCredentials,
} from "@servicebeard/db";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { isLocalLoginEnabled } from "../env";
import { logger } from "../logger";
import { shouldRequireEmailVerification } from "../transactional-mail";
import { localAccountExternalSub } from "./dev-account";
import type { LoginIdentity } from "./types";
import { emailToUserHandle, getWebAuthnConfig } from "./webauthn-config";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function assertLocalLoginEnabled(): void {
  if (!isLocalLoginEnabled()) {
    throw new Error("LOGIN_PROVIDER_DISABLED");
  }
}

async function storeChallenge(input: {
  challenge: string;
  type: "register" | "authenticate";
  email?: string;
  userId?: string;
}): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db
    .delete(webauthnChallenges)
    .where(lt(webauthnChallenges.expiresAt, new Date()));

  await db.insert(webauthnChallenges).values({
    challenge: input.challenge,
    type: input.type,
    email: input.email,
    userId: input.userId,
    expiresAt,
  });
}

async function consumeChallenge(
  challenge: string,
  type: "register" | "authenticate",
): Promise<typeof webauthnChallenges.$inferSelect> {
  const db = getDb();
  const row = await db.query.webauthnChallenges.findFirst({
    where: and(
      eq(webauthnChallenges.challenge, challenge),
      eq(webauthnChallenges.type, type),
      gt(webauthnChallenges.expiresAt, new Date()),
    ),
  });

  if (!row) {
    throw new Error("WEBAUTHN_CHALLENGE_EXPIRED");
  }

  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, row.id));
  return row;
}

function externalSubForEmail(email: string): string {
  return localAccountExternalSub(email);
}

function parseClientDataChallenge(clientDataJSON: string): string {
  const clientData = JSON.parse(
    Buffer.from(clientDataJSON, "base64url").toString("utf8"),
  ) as { challenge?: string };
  if (!clientData.challenge) {
    throw new Error("WEBAUTHN_VERIFICATION_FAILED");
  }
  return clientData.challenge;
}

export async function createPasskeyRegistrationOptions(input: {
  email: string;
  name: string;
  signupEnabled: boolean;
}) {
  assertLocalLoginEnabled();

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) {
    throw new Error("INVALID_PASSKEY_REGISTRATION");
  }

  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  if (!input.signupEnabled) {
    throw new Error("SIGNUP_DISABLED");
  }

  const { rpId, rpName } = getWebAuthnConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: email,
    userDisplayName: name,
    userID: new Uint8Array(emailToUserHandle(email)),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  await storeChallenge({
    challenge: options.challenge,
    type: "register",
    email,
  });

  return options;
}

export async function verifyPasskeyRegistration(input: {
  email: string;
  name: string;
  response: RegistrationResponseJSON;
  signupEnabled: boolean;
}): Promise<LoginIdentity> {
  assertLocalLoginEnabled();

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const challenge = parseClientDataChallenge(
    input.response.response.clientDataJSON,
  );
  const challengeRecord = await consumeChallenge(challenge, "register");

  if (challengeRecord.email !== email) {
    throw new Error("WEBAUTHN_VERIFICATION_FAILED");
  }

  const { origin, rpId } = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("WEBAUTHN_VERIFICATION_FAILED");
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;
  const db = getDb();
  const externalSub = externalSubForEmail(email);

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  if (!input.signupEnabled) {
    throw new Error("SIGNUP_DISABLED");
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      oidcSub: externalSub,
      emailVerifiedAt: shouldRequireEmailVerification() ? null : new Date(),
    })
    .returning();

  await db.insert(webauthnCredentials).values({
    userId: user.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports,
  });

  logger.info({ email, userId: user.id }, "passkey registered");

  return {
    externalSub,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

export async function createPasskeyAuthenticationOptions() {
  assertLocalLoginEnabled();
  const { rpId } = getWebAuthnConfig();

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "preferred",
  });

  await storeChallenge({
    challenge: options.challenge,
    type: "authenticate",
  });

  return options;
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<LoginIdentity> {
  assertLocalLoginEnabled();

  const challenge = parseClientDataChallenge(response.response.clientDataJSON);
  await consumeChallenge(challenge, "authenticate");

  const db = getDb();
  const credential = await db.query.webauthnCredentials.findFirst({
    where: eq(webauthnCredentials.credentialId, response.id),
    with: { user: true },
  });

  if (!credential?.user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const { origin, rpId } = getWebAuthnConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
      transports: credential.transports as
        AuthenticatorTransportFuture[] | undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("WEBAUTHN_VERIFICATION_FAILED");
  }

  const { newCounter } = verification.authenticationInfo;
  await db
    .update(webauthnCredentials)
    .set({ counter: newCounter, updatedAt: new Date() })
    .where(eq(webauthnCredentials.id, credential.id));

  logger.info(
    { email: credential.user.email, userId: credential.user.id },
    "passkey login",
  );

  return {
    externalSub: credential.user.oidcSub,
    email: credential.user.email,
    name: credential.user.name,
    avatarUrl: credential.user.avatarUrl,
  };
}
