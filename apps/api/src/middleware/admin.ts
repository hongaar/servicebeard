import type { Context } from "hono";
import type { SessionUser } from "@servicebeard/shared";
import type { AppVariables } from "./auth";
import { requireAuth } from "./auth";

export function requirePlatformAdmin(
  c: Context<{ Variables: AppVariables }>,
): SessionUser {
  const user = requireAuth(c);
  if (!user.isAdmin) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
