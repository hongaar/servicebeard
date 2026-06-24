import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { getSessionUser, getSessionCookieName } from "../lib/auth";
import type { SessionUser } from "@servicebeard/shared";

export type AppVariables = {
  user: SessionUser | null;
};

export async function authMiddleware(
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const token = getCookie(c, getSessionCookieName());
  const user = await getSessionUser(token);
  c.set("user", user);
  await next();
}

export function requireAuth(
  c: Context<{ Variables: AppVariables }>,
): SessionUser {
  const user = c.get("user");
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
