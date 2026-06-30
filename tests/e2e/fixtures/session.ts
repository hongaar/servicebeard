import { generateToken, getDb, hashToken, sessions } from "@servicebeard/db";
import { SESSION_COOKIE } from "./constants";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function mintSession(userId: string): Promise<string> {
  const db = getDb();
  const sessionToken = generateToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return sessionToken;
}

export async function mintExpiredSession(userId: string): Promise<string> {
  const db = getDb();
  const sessionToken = generateToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() - 60_000);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return sessionToken;
}
