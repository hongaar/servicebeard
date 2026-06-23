import { getDb, teamMembers } from "@serviceboard/db";
import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import type { AppVariables } from "./auth";
import { requireAuth } from "./auth";

export async function requireTeamMember(
  c: Context<{ Variables: AppVariables }>,
  teamId: string,
  minRole?: "member" | "admin" | "owner",
): Promise<{ userId: string; role: string }> {
  const user = requireAuth(c);
  const db = getDb();

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)),
  });

  if (!member) {
    throw new Error("FORBIDDEN");
  }

  if (minRole) {
    const roleHierarchy = { member: 0, admin: 1, owner: 2 };
    if (
      roleHierarchy[member.role as keyof typeof roleHierarchy] <
      roleHierarchy[minRole]
    ) {
      throw new Error("FORBIDDEN");
    }
  }

  return { userId: user.id, role: member.role };
}

export function teamGuard(minRole?: "member" | "admin" | "owner") {
  return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    const teamId = c.req.param("teamId");
    if (!teamId) throw new Error("FORBIDDEN");
    await requireTeamMember(c, teamId, minRole);
    await next();
  };
}
