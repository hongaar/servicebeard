import { getDb, teamMembers, teams } from "@servicebeard/db";
import { appendSlugSuffix } from "@servicebeard/shared";
import { and, eq } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

export async function resolveUniqueTeamSlug(
  db: Db,
  baseSlug: string,
  excludeTeamId?: string,
): Promise<string> {
  const normalized = baseSlug.slice(0, 50);
  let slug = normalized;
  let suffix = 2;

  while (true) {
    const existing = await db.query.teams.findFirst({
      where: eq(teams.slug, slug),
      columns: { id: true },
    });
    if (!existing || existing.id === excludeTeamId) return slug;
    slug = appendSlugSuffix(normalized, suffix++);
  }
}

/** Reuse an owned team on retry, or pick a slug that does not collide globally. */
export async function prepareTeamSlugForCreate(
  db: Db,
  userId: string,
  requestedSlug: string,
): Promise<{ slug: string; existingTeam: typeof teams.$inferSelect | null }> {
  const existing = await db.query.teams.findFirst({
    where: eq(teams.slug, requestedSlug),
  });

  if (existing) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, existing.id),
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "owner"),
      ),
    });
    if (membership) {
      return { slug: existing.slug, existingTeam: existing };
    }
    return {
      slug: await resolveUniqueTeamSlug(db, requestedSlug),
      existingTeam: null,
    };
  }

  return { slug: requestedSlug, existingTeam: null };
}
