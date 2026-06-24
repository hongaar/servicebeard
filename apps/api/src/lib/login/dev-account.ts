import { getDb, users } from "@servicebeard/db";
import { eq } from "drizzle-orm";
import { isLocalLoginEnabled } from "../env";
import { logger } from "../logger";
import { hashPassword } from "./password";

export const DEV_ACCOUNT_EMAIL = "dev@localhost";
export const DEV_ACCOUNT_NAME = "Dev User";
export const DEV_ACCOUNT_PASSWORD = "dev";

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function devAccountExternalSub(
  email = DEV_ACCOUNT_EMAIL,
): string {
  return `dev:${email.toLowerCase()}`;
}

/** Bcrypt hash for DEV_ACCOUNT_PASSWORD (cost 12). Used by SQL backfill migration. */
export const DEV_ACCOUNT_PASSWORD_HASH =
  "$2b$12$9u/jH7yQwmkVKUvxP1oTtuNnMj7GDcBU2YgET1BO8mnONxmG3d32G";

export async function seedDevLocalAccount(): Promise<void> {
  if (!isDevEnvironment() || !isLocalLoginEnabled()) {
    return;
  }

  const db = getDb();
  const externalSub = devAccountExternalSub();
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
    logger.info({ email: DEV_ACCOUNT_EMAIL }, "seeded dev local account");
    return;
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
    logger.info({ email: DEV_ACCOUNT_EMAIL }, "backfilled dev local account password");
  }
}
