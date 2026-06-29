import {
    getDb,
    userAuthProviders,
    users,
    webauthnCredentials,
} from "@servicebeard/db";
import type { LoginProviderType } from "@servicebeard/shared/login";
import { and, eq } from "drizzle-orm";

const REDIRECT_PROVIDERS = new Set<LoginProviderType>(["github", "gitlab", "oidc"]);

export function inferProviderFromExternalSub(externalSub: string): LoginProviderType {
  if (externalSub.startsWith("github:")) return "github";
  if (externalSub.startsWith("gitlab:")) return "gitlab";
  if (externalSub.startsWith("dev:")) return "local";
  return "oidc";
}

export function isRedirectProvider(provider: LoginProviderType): boolean {
  return REDIRECT_PROVIDERS.has(provider);
}

export async function findUserIdByProviderIdentity(
  provider: LoginProviderType,
  externalSub: string,
): Promise<string | null> {
  const db = getDb();

  const linked = await db.query.userAuthProviders.findFirst({
    where: and(
      eq(userAuthProviders.provider, provider),
      eq(userAuthProviders.externalSub, externalSub),
    ),
    columns: { userId: true },
  });
  if (linked) return linked.userId;

  const legacy = await db.query.users.findFirst({
    where: eq(users.oidcSub, externalSub),
    columns: { id: true },
  });
  if (!legacy) return null;

  await ensureProviderLink(legacy.id, provider, externalSub);
  return legacy.id;
}

export async function ensureProviderLink(
  userId: string,
  provider: LoginProviderType,
  externalSub: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(userAuthProviders)
    .values({ userId, provider, externalSub })
    .onConflictDoNothing({
      target: [userAuthProviders.provider, userAuthProviders.externalSub],
    });
}

export async function listLinkedProviders(userId: string) {
  const db = getDb();
  return db.query.userAuthProviders.findMany({
    where: eq(userAuthProviders.userId, userId),
    columns: { provider: true, externalSub: true, createdAt: true },
  });
}

export async function isProviderLinkedToUser(
  userId: string,
  provider: LoginProviderType,
): Promise<boolean> {
  const db = getDb();
  const row = await db.query.userAuthProviders.findFirst({
    where: and(
      eq(userAuthProviders.userId, userId),
      eq(userAuthProviders.provider, provider),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function findProviderOwner(
  provider: LoginProviderType,
  externalSub: string,
): Promise<string | null> {
  const db = getDb();
  const row = await db.query.userAuthProviders.findFirst({
    where: and(
      eq(userAuthProviders.provider, provider),
      eq(userAuthProviders.externalSub, externalSub),
    ),
    columns: { userId: true },
  });
  return row?.userId ?? null;
}

export async function linkProviderToUser(
  userId: string,
  provider: LoginProviderType,
  externalSub: string,
): Promise<void> {
  if (!isRedirectProvider(provider)) {
    throw new Error("PROVIDER_LINK_NOT_SUPPORTED");
  }

  const existingOwner = await findProviderOwner(provider, externalSub);
  if (existingOwner && existingOwner !== userId) {
    throw new Error("PROVIDER_ALREADY_LINKED");
  }

  const alreadyLinked = await isProviderLinkedToUser(userId, provider);
  if (alreadyLinked) {
    throw new Error("PROVIDER_ALREADY_LINKED");
  }

  await ensureProviderLink(userId, provider, externalSub);
}

export async function countSignInMethods(userId: string): Promise<number> {
  const db = getDb();

  const [providerRows, passkeyRows, user] = await Promise.all([
    db
      .select({ provider: userAuthProviders.provider })
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, userId)),
    db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId)),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: true },
    }),
  ]);

  const redirectCount = providerRows.filter((row) => row.provider !== "local").length;
  const hasLocal =
    providerRows.some((row) => row.provider === "local") ||
    Boolean(user?.passwordHash) ||
    passkeyRows.length > 0;

  return redirectCount + (hasLocal ? 1 : 0);
}

export async function unlinkProviderFromUser(
  userId: string,
  provider: LoginProviderType,
): Promise<void> {
  if (!isRedirectProvider(provider)) {
    throw new Error("PROVIDER_UNLINK_NOT_SUPPORTED");
  }

  const linked = await isProviderLinkedToUser(userId, provider);
  if (!linked) {
    throw new Error("PROVIDER_NOT_LINKED");
  }

  const remaining = await countSignInMethods(userId);
  if (remaining <= 1) {
    throw new Error("LAST_AUTH_METHOD");
  }

  const db = getDb();
  await db
    .delete(userAuthProviders)
    .where(
      and(eq(userAuthProviders.userId, userId), eq(userAuthProviders.provider, provider)),
    );
}

export async function assertEmailAvailableForSignup(
  email: string,
  externalSub: string,
): Promise<void> {
  const db = getDb();
  const conflict = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, oidcSub: true },
  });

  if (conflict && conflict.oidcSub !== externalSub) {
    throw new Error("EMAIL_TAKEN");
  }
}
