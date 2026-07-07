import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  issueThreads,
  projects,
  projectStatusEvents,
  rules,
  teamMembers,
  teams,
} from "./schema";

export type AdminTeamOverview = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  projectCount: number;
};

export type AdminProjectOverview = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  isActive: boolean;
  createdAt: Date;
  ruleCount: number;
  conversationCount: number;
  statusEvents: {
    error: number;
    warning: number;
    info: number;
  };
};

export async function listAdminTeams(input: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ teams: AdminTeamOverview[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const db = getDb();

  const conditions = [];
  const search = input.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(teams.name, pattern), ilike(teams.slug, pattern)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      createdAt: teams.createdAt,
      memberCount: sql<number>`count(distinct ${teamMembers.id})::int`,
      projectCount: sql<number>`count(distinct ${projects.id})::int`,
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(projects, eq(projects.teamId, teams.id))
    .where(where)
    .groupBy(teams.id)
    .orderBy(asc(teams.name))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teams)
    .where(where);

  return {
    teams: rows.map((row) => ({
      ...row,
      memberCount: row.memberCount ?? 0,
      projectCount: row.projectCount ?? 0,
    })),
    total: totalRow?.count ?? 0,
  };
}

export async function listAdminProjects(input: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ projects: AdminProjectOverview[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const db = getDb();

  const conditions = [];
  const search = input.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(projects.name, pattern), ilike(teams.name, pattern)),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      teamId: projects.teamId,
      teamName: teams.name,
      isActive: projects.isActive,
      createdAt: projects.createdAt,
      ruleCount: sql<number>`count(distinct ${rules.id})::int`,
      conversationCount: sql<number>`count(distinct ${issueThreads.id})::int`,
      statusErrorCount: sql<number>`count(distinct ${projectStatusEvents.id}) filter (where ${projectStatusEvents.dismissedAt} is null and ${projectStatusEvents.severity} = 'error')::int`,
      statusWarningCount: sql<number>`count(distinct ${projectStatusEvents.id}) filter (where ${projectStatusEvents.dismissedAt} is null and ${projectStatusEvents.severity} = 'warning')::int`,
      statusInfoCount: sql<number>`count(distinct ${projectStatusEvents.id}) filter (where ${projectStatusEvents.dismissedAt} is null and ${projectStatusEvents.severity} = 'info')::int`,
    })
    .from(projects)
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .leftJoin(rules, eq(rules.projectId, projects.id))
    .leftJoin(issueThreads, eq(issueThreads.projectId, projects.id))
    .leftJoin(
      projectStatusEvents,
      eq(projectStatusEvents.projectId, projects.id),
    )
    .where(where)
    .groupBy(projects.id, teams.id, teams.name)
    .orderBy(asc(teams.name), asc(projects.name))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .where(where);

  return {
    projects: rows.map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      teamName: row.teamName,
      isActive: row.isActive,
      createdAt: row.createdAt,
      ruleCount: row.ruleCount ?? 0,
      conversationCount: row.conversationCount ?? 0,
      statusEvents: {
        error: row.statusErrorCount ?? 0,
        warning: row.statusWarningCount ?? 0,
        info: row.statusInfoCount ?? 0,
      },
    })),
    total: totalRow?.count ?? 0,
  };
}
