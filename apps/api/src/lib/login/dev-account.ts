import {
    DEV_ACCOUNT_EMAIL,
    seedDevLocalAccount as seedDevLocalAccountDb,
} from "@servicebeard/db";
import { logger } from "../logger";

export {
    DEV_ACCOUNT_EMAIL,
    DEV_ACCOUNT_NAME,
    DEV_ACCOUNT_PASSWORD,
    DEV_ACCOUNT_PASSWORD_HASH,
    localAccountExternalSub
} from "@servicebeard/db";

export async function seedDevLocalAccount(): Promise<void> {
  const result = await seedDevLocalAccountDb();
  if (result === "created") {
    logger.info({ email: DEV_ACCOUNT_EMAIL }, "seeded dev local account");
  } else if (result === "backfilled") {
    logger.info({ email: DEV_ACCOUNT_EMAIL }, "backfilled dev local account password");
  }
}
