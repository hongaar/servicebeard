import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { users } from "./schema";

export const DEV_ACCOUNT_EMAIL = "dev@localhost";
export const DEV_ACCOUNT_NAME = "Dev User";
export const DEV_ACCOUNT_PASSWORD = "dev";

export function localAccountExternalSub(email = DEV_ACCOUNT_EMAIL): string {
  return `local:${email.toLowerCase()}`;
}

/** Bcrypt hash for DEV_ACCOUNT_PASSWORD (cost 12). Used by SQL backfill migration. */
export const DEV_ACCOUNT_PASSWORD_HASH =
  "$2b$12$9u/jH7yQwmkVKUvxP1oTtuNnMj7GDcBU2YgET1BO8mnONxmG3d32G";

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isLocalLoginEnabled(): boolean {
  return process.env.LOCAL_LOGIN === "true";
}

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 12,
  });
}

export type SeedDevAccountResult = "created" | "backfilled" | "skipped";

export async function seedDevLocalAccount(): Promise<SeedDevAccountResult> {
  if (!isDevEnvironment() || !isLocalLoginEnabled()) {
    return "skipped";
  }

  const db = getDb();
  const externalSub = localAccountExternalSub();
  const passwordHash = await hashPassword(DEV_ACCOUNT_PASSWORD);

  const existing = await db.query.users.findFirst({
    where: eq(users.oidcSub, externalSub),
  });

  if (!existing) {
    await db.insert(users).values({
      email: DEV_ACCOUNT_EMAIL,
      name: DEV_ACCOUNT_NAME,
      oidcSub: externalSub,
      passwordHash,
    });
    return "created";
  }

  if (!existing.passwordHash) {
    await db
      .update(users)
      .set({
        passwordHash,
        name: existing.name ?? DEV_ACCOUNT_NAME,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return "backfilled";
  }

  return "skipped";
}
