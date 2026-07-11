import {
  generateToken,
  getDb,
  hashToken,
  sessions,
  users,
} from "@servicebeard/db";
import type { SessionUser } from "@servicebeard/shared";
import type { LoginProviderType } from "@servicebeard/shared/login";
import { and, eq, gt } from "drizzle-orm";
import { toSessionEmailVerified } from "../transactional-mail";
import {
  assertEmailAvailableForSignup,
  ensureProviderLink,
  findUserIdByProviderIdentity,
} from "./providers";
import type { LoginIdentity } from "./types";

const SESSION_COOKIE = "sd_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

function toSessionUser(user: {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  emailVerifiedAt: Date | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    emailVerified: toSessionEmailVerified(user),
  };
}

export async function createSessionForIdentity(
  identity: LoginIdentity,
  opts: { allowSignup: boolean; provider: LoginProviderType },
): Promise<{ token: string; user: SessionUser }> {
  const db = getDb();
  const oauthProvider = opts.provider !== "local";

  let userId = await findUserIdByProviderIdentity(
    opts.provider,
    identity.externalSub,
  );

  if (!userId) {
    if (!opts.allowSignup) {
      throw new Error("SIGNUP_DISABLED");
    }

    await assertEmailAvailableForSignup(identity.email, identity.externalSub);

    const [created] = await db
      .insert(users)
      .values({
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl ?? null,
        oidcSub: identity.externalSub,
        emailVerifiedAt: oauthProvider ? new Date() : null,
      })
      .returning();
    userId = created!.id;
    await ensureProviderLink(userId, opts.provider, identity.externalSub);
  } else {
    await db
      .update(users)
      .set({
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await ensureProviderLink(userId, opts.provider, identity.externalSub);
  }

  return createSessionForUser(userId);
}

export async function createSessionForUser(
  userId: string,
): Promise<{ token: string; user: SessionUser }> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const sessionToken = generateToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    token: sessionToken,
    user: toSessionUser(user),
  };
}

export async function getSessionUser(
  sessionToken: string | undefined,
): Promise<SessionUser | null> {
  if (!sessionToken) return null;

  const db = getDb();
  const tokenHash = hashToken(sessionToken);

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, new Date()),
    ),
    with: { user: true },
  });

  if (!session?.user) return null;

  return toSessionUser(session.user);
}

export async function destroySession(sessionToken: string): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(sessionToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
