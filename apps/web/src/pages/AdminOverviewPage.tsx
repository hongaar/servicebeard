import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Layout } from "../components/Layout";
import {
  api,
  type AdminProjectOverview,
  type AdminTeamOverview,
} from "../lib/api";
import styles from "../styles/pages.module.css";

type OverviewTab = "teams" | "projects";

function StatusEventCounts({
  counts,
}: {
  counts: AdminProjectOverview["statusEvents"];
}) {
  const total = counts.error + counts.warning + counts.info;
  if (total === 0) {
    return <span className={styles.adminMuted}>All clear</span>;
  }

  return (
    <span className={styles.adminStatusCounts}>
      {counts.error > 0 && (
        <span className={[styles.badge, styles.statusSeverityError].join(" ")}>
          {counts.error} error{counts.error === 1 ? "" : "s"}
        </span>
      )}
      {counts.warning > 0 && (
        <span
          className={[styles.badge, styles.statusSeverityWarning].join(" ")}
        >
          {counts.warning} warning{counts.warning === 1 ? "" : "s"}
        </span>
      )}
      {counts.info > 0 && (
        <span className={[styles.badge, styles.statusSeverityInfo].join(" ")}>
          {counts.info} info
        </span>
      )}
    </span>
  );
}

export function AdminOverviewPage() {
  const { user } = useLoaderData({ from: "/admin" });
  const [tab, setTab] = useState<OverviewTab>("teams");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [tab]);

  const teamsQuery = useQuery({
    queryKey: ["admin-teams", debouncedSearch, offset],
    queryFn: () =>
      api.listAdminTeams({
        search: debouncedSearch || undefined,
        limit,
        offset,
      }),
    enabled: tab === "teams",
  });

  const projectsQuery = useQuery({
    queryKey: ["admin-projects", debouncedSearch, offset],
    queryFn: () =>
      api.listAdminProjects({
        search: debouncedSearch || undefined,
        limit,
        offset,
      }),
    enabled: tab === "projects",
  });

  const activeQuery = tab === "teams" ? teamsQuery : projectsQuery;
  const total = activeQuery.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <Layout
      user={user}
      title="Overview"
      description="Platform-wide teams and projects."
    >
      <div className={styles.adminPage}>
        <div className={styles.tabs} role="tablist" aria-label="Overview">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "teams"}
            className={[styles.tab, tab === "teams" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab("teams")}
          >
            Teams
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "projects"}
            className={[styles.tab, tab === "projects" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab("projects")}
          >
            Projects
          </button>
        </div>

        <div className={styles.adminFilterRow}>
          <div className={styles.adminSearchField}>
            <Input
              label="Search"
              placeholder={
                tab === "teams" ? "Team name or slug…" : "Project or team name…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {activeQuery.isLoading ? (
          <p className={styles.formHint}>Loading…</p>
        ) : activeQuery.isError ? (
          <p className={styles.testError}>
            {activeQuery.error instanceof Error
              ? activeQuery.error.message
              : "Failed to load overview"}
          </p>
        ) : tab === "teams" ? (
          <TeamsTable teams={teamsQuery.data?.teams ?? []} />
        ) : (
          <ProjectsTable projects={projectsQuery.data?.projects ?? []} />
        )}

        <div className={styles.adminPagination}>
          <span>
            {total === 0 ? "No results" : `${pageStart}–${pageEnd} of ${total}`}
          </span>
          <Button
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function TeamsTable({ teams }: { teams: AdminTeamOverview[] }) {
  if (teams.length === 0) {
    return <p className={styles.formHint}>No teams found.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Members</th>
            <th>Projects</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td>
                <Link to="/teams/$teamId/projects" params={{ teamId: team.id }}>
                  {team.name}
                </Link>
              </td>
              <td>
                <code>{team.slug}</code>
              </td>
              <td>{team.memberCount}</td>
              <td>{team.projectCount}</td>
              <td>{new Date(team.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsTable({ projects }: { projects: AdminProjectOverview[] }) {
  if (projects.length === 0) {
    return <p className={styles.formHint}>No projects found.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Project</th>
            <th>Team</th>
            <th>Status</th>
            <th>Rules</th>
            <th>Conversations</th>
            <th>Events</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <Link
                  to="/teams/$teamId/projects/$projectId/$section"
                  params={{
                    teamId: project.teamId,
                    projectId: project.id,
                    section: "overview",
                  }}
                >
                  {project.name}
                </Link>
              </td>
              <td>
                <Link
                  to="/teams/$teamId/projects"
                  params={{ teamId: project.teamId }}
                >
                  {project.teamName}
                </Link>
              </td>
              <td>
                <span
                  className={
                    project.isActive ? styles.testOk : styles.adminMuted
                  }
                >
                  {project.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td>{project.ruleCount}</td>
              <td>{project.conversationCount}</td>
              <td>
                <StatusEventCounts counts={project.statusEvents} />
              </td>
              <td>{new Date(project.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
