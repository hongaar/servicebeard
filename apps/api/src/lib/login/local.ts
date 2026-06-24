import { getDb, users } from "@servicebeard/db";
import { eq } from "drizzle-orm";
import { isLocalLoginEnabled } from "../env";
import { logger } from "../logger";
import {
  DEV_ACCOUNT_EMAIL,
  DEV_ACCOUNT_NAME,
  DEV_ACCOUNT_PASSWORD,
  devAccountExternalSub,
} from "./dev-account";
import { hashPassword, verifyPassword } from "./password";
import type { CredentialLoginAdapter } from "./types";

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isLocalSignupEnabled(): boolean {
  if (process.env.LOCAL_LOGIN_SIGNUP === "false") return false;
  if (process.env.LOCAL_LOGIN_SIGNUP === "true") return true;
  return isLocalLoginEnabled();
}

function externalSubForEmail(email: string): string {
  return devAccountExternalSub(email);
}

export class LocalLoginAdapter implements CredentialLoginAdapter {
  readonly type = "local" as const;
  readonly label = "Sign in locally";
  readonly settings = { signupEnabled: isLocalSignupEnabled() };

  isEnabled(): boolean {
    return isLocalLoginEnabled();
  }

  toPublicConfig() {
    const config = {
      type: this.type,
      label: this.label,
      signupEnabled: this.settings.signupEnabled,
      passkeyEnabled: this.isEnabled(),
    } as const;

    if (!this.isEnabled() || !isDevEnvironment()) {
      return config;
    }

    return {
      ...config,
      defaults: {
        email: DEV_ACCOUNT_EMAIL,
        name: DEV_ACCOUNT_NAME,
        password: DEV_ACCOUNT_PASSWORD,
      },
    };
  }

  async login(credentials: {
    email: string;
    password: string;
    name?: string;
    mode: "login" | "signup";
  }) {
    if (!this.isEnabled()) {
      throw new Error("LOGIN_PROVIDER_DISABLED");
    }

    const email = credentials.email.trim().toLowerCase() || DEV_ACCOUNT_EMAIL;
    const password = credentials.password;
    if (!password) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const externalSub = externalSubForEmail(email);
    const db = getDb();
    const existing = await db.query.users.findFirst({
      where: eq(users.oidcSub, externalSub),
    });

    if (credentials.mode === "signup") {
      if (!this.settings.signupEnabled) {
        throw new Error("SIGNUP_DISABLED");
      }
      if (existing?.passwordHash) {
        throw new Error("EMAIL_TAKEN");
      }

      const name = credentials.name?.trim() || DEV_ACCOUNT_NAME;
      const passwordHash = await hashPassword(password);

      if (existing) {
        await db
          .update(users)
          .set({ name, passwordHash, updatedAt: new Date() })
          .where(eq(users.id, existing.id));

        logger.warn({ email }, "local signup password set for existing user");

        return {
          externalSub,
          email: existing.email,
          name,
          avatarUrl: existing.avatarUrl,
        };
      }

      const [created] = await db
        .insert(users)
        .values({ email, name, oidcSub: externalSub, passwordHash })
        .returning();

      logger.warn({ email }, "local signup");

      return {
        externalSub,
        email: created.email,
        name: created.name,
        avatarUrl: created.avatarUrl,
      };
    }

    if (!existing?.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(password, existing.passwordHash);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    logger.warn({ email }, "local login");

    return {
      externalSub,
      email: existing.email,
      name: existing.name,
      avatarUrl: existing.avatarUrl,
    };
  }
}
