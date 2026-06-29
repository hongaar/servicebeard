import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "./index";
import {
    issueThreads,
    projectStatusEvents,
    projects,
    teamMembers,
    teams,
    users,
} from "./schema";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function likePattern(query: string): string {
  const safe = query.replace(/[%_]/g, " ").trim();
  return `%${safe}%`;
}

export interface GlobalSearchTeamHit {
  id: string;
  name: string;
}

export interface GlobalSearchProjectHit {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
}

export interface GlobalSearchMemberHit {
  id: string;
  name: string | null;
  email: string;
  role: string;
  teamId: string;
  teamName: string;
}

export interface GlobalSearchConversationHit {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
}

export interface GlobalSearchStatusEventHit {
  id: string;
  message: string;
  operation: string;
  severity: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
}

export interface GlobalSearchResults {
  teams: GlobalSearchTeamHit[];
  projects: GlobalSearchProjectHit[];
  members: GlobalSearchMemberHit[];
  conversations: GlobalSearchConversationHit[];
  statusEvents: GlobalSearchStatusEventHit[];
}

const emptyResults = (): GlobalSearchResults => ({
  teams: [],
  projects: [],
  members: [],
  conversations: [],
  statusEvents: [],
});

export async function globalSearch(
  userId: string,
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<GlobalSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return emptyResults();

  const perKindLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const pattern = likePattern(trimmed);
  const db = getDb();

  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: { team: true },
  });

  const teamIds = memberships.map((membership) => membership.teamId);
  if (teamIds.length === 0) return emptyResults();

  const [teamHits, projectHits, memberHits, conversationHits, statusEventHits] =
    await Promise.all([
      db.query.teams.findMany({
        where: and(
          inArray(teams.id, teamIds),
          or(ilike(teams.name, pattern), ilike(teams.slug, pattern)),
        ),
        columns: { id: true, name: true },
        limit: perKindLimit,
      }),

      db
        .select({
          id: projects.id,
          name: projects.name,
          teamId: projects.teamId,
          teamName: teams.name,
        })
        .from(projects)
        .innerJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            inArray(projects.teamId, teamIds),
            or(ilike(projects.name, pattern), ilike(projects.slug, pattern)),
          ),
        )
        .limit(perKindLimit),

      db
        .select({
          id: teamMembers.id,
          name: users.name,
          email: users.email,
          role: teamMembers.role,
          teamId: teamMembers.teamId,
          teamName: teams.name,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(
          and(
            inArray(teamMembers.teamId, teamIds),
            or(ilike(users.email, pattern), ilike(users.name, pattern)),
          ),
        )
        .limit(perKindLimit),

      db
        .select({
          id: issueThreads.id,
          subject: issueThreads.subjectNormalized,
          senderEmail: issueThreads.originalSenderEmail,
          senderName: issueThreads.originalSenderName,
          projectId: projects.id,
          projectName: projects.name,
          teamId: projects.teamId,
          teamName: teams.name,
        })
        .from(issueThreads)
        .innerJoin(projects, eq(issueThreads.projectId, projects.id))
        .innerJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            inArray(projects.teamId, teamIds),
            or(
              ilike(issueThreads.subjectNormalized, pattern),
              ilike(issueThreads.originalSenderEmail, pattern),
              ilike(issueThreads.originalSenderName, pattern),
            ),
          ),
        )
        .orderBy(desc(issueThreads.updatedAt))
        .limit(perKindLimit),

      db
        .select({
          id: projectStatusEvents.id,
          message: projectStatusEvents.message,
          operation: projectStatusEvents.operation,
          severity: projectStatusEvents.severity,
          projectId: projects.id,
          projectName: projects.name,
          teamId: projects.teamId,
          teamName: teams.name,
        })
        .from(projectStatusEvents)
        .innerJoin(projects, eq(projectStatusEvents.projectId, projects.id))
        .innerJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            inArray(projects.teamId, teamIds),
            isNull(projectStatusEvents.dismissedAt),
            or(
              ilike(projectStatusEvents.message, pattern),
              ilike(projectStatusEvents.operation, pattern),
            ),
          ),
        )
        .orderBy(desc(projectStatusEvents.createdAt))
        .limit(perKindLimit),
    ]);

  return {
    teams: teamHits.map((team) => ({ id: team.id, name: team.name })),
    projects: projectHits.map((project) => ({
      id: project.id,
      name: project.name,
      teamId: project.teamId,
      teamName: project.teamName,
    })),
    members: memberHits.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      teamId: member.teamId,
      teamName: member.teamName,
    })),
    conversations: conversationHits.map((conversation) => ({
      id: conversation.id,
      subject: conversation.subject,
      senderEmail: conversation.senderEmail,
      senderName: conversation.senderName,
      projectId: conversation.projectId,
      projectName: conversation.projectName,
      teamId: conversation.teamId,
      teamName: conversation.teamName,
    })),
    statusEvents: statusEventHits.map((event) => ({
      id: event.id,
      message: event.message,
      operation: event.operation,
      severity: event.severity,
      projectId: event.projectId,
      projectName: event.projectName,
      teamId: event.teamId,
      teamName: event.teamName,
    })),
  };
}
