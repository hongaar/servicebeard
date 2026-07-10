import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  formatJobRunDuration,
  formatJobRunTimestamp,
  jobRunContextLabel,
  JobRunDetailsDialog,
  jobRunStatusClass,
} from "../components/JobRunDetailsDialog";
import { Layout } from "../components/Layout";
import { api, type AdminJobRun } from "../lib/api";
import styles from "../styles/pages.module.css";

function hasDetails(run: AdminJobRun): boolean {
  return (
    !!run.error ||
    !!run.metadata ||
    run.status === "failed" ||
    run.status === "deferred"
  );
}

function JobRunsTable({
  runs,
  onShowDetails,
}: {
  runs: AdminJobRun[];
  onShowDetails: (run: AdminJobRun) => void;
}) {
  if (runs.length === 0) {
    return <p className={styles.formHint}>No job runs match your filters.</p>;
  }

  return (
    <div
      className={[styles.tableWrap, styles.adminAuditLogTableWrap].join(" ")}
    >
      <table className={[styles.table, styles.adminAuditLogTable].join(" ")}>
        <thead>
          <tr>
            <th className={styles.adminAuditLogCompactCell}>Started</th>
            <th className={styles.adminAuditLogCompactCell}>Job</th>
            <th className={styles.adminAuditLogCompactCell}>Status</th>
            <th className={styles.adminAuditLogCompactCell}>Duration</th>
            <th className={styles.adminAuditLogCompactCell}>Context</th>
            <th className={styles.adminAuditLogDetailsCol}>Details</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const contextLabel = jobRunContextLabel(run);
            const projectId =
              run.projectId ??
              (typeof run.metadata?.projectId === "string"
                ? run.metadata.projectId
                : null);
            const teamId =
              run.teamId ??
              (typeof run.metadata?.teamId === "string"
                ? run.metadata.teamId
                : null);

            return (
              <tr key={run.id}>
                <td
                  className={[
                    styles.adminAuditLogCompactCell,
                    styles.adminMuted,
                  ].join(" ")}
                >
                  {formatJobRunTimestamp(run.startedAt)}
                </td>
                <td className={styles.adminAuditLogCompactCell}>
                  <code>{run.jobType}</code>
                </td>
                <td className={styles.adminAuditLogCompactCell}>
                  <span className={jobRunStatusClass(run.status)}>
                    {run.status}
                  </span>
                </td>
                <td
                  className={[
                    styles.adminAuditLogCompactCell,
                    styles.adminMuted,
                  ].join(" ")}
                >
                  {formatJobRunDuration(run.durationMs)}
                </td>
                <td className={styles.adminAuditLogCompactCell}>
                  {projectId && teamId ? (
                    <Link
                      to="/teams/$teamId/projects/$projectId/$section"
                      params={{
                        teamId,
                        projectId,
                        section: "status",
                      }}
                      className={styles.tableRowLink}
                    >
                      {contextLabel}
                    </Link>
                  ) : (
                    <span className={styles.adminMuted}>{contextLabel}</span>
                  )}
                </td>
                <td className={styles.adminAuditLogDetailsCol}>
                  {hasDetails(run) ? (
                    <div className={styles.adminAuditLogDetailsCell}>
                      <code>
                        {run.error
                          ? run.error.slice(0, 40) +
                            (run.error.length > 40 ? "…" : "")
                          : run.status}
                      </code>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => onShowDetails(run)}
                      >
                        Show
                      </Button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminJobRunsPage() {
  const { user } = useLoaderData({ from: "/admin/job-runs" });
  const [search, setSearch] = useState("");
  const [jobType, setJobType] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedFilters, setDebouncedFilters] = useState({
    search: "",
    jobType: "",
    status: "",
  });
  const [offset, setOffset] = useState(0);
  const [detailsRun, setDetailsRun] = useState<AdminJobRun | null>(null);
  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({
        search: search.trim(),
        jobType: jobType.trim(),
        status: status.trim(),
      });
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, jobType, status]);

  const jobRunsQuery = useQuery({
    queryKey: ["admin-job-runs", debouncedFilters, offset],
    queryFn: () =>
      api.listJobRuns({
        search: debouncedFilters.search || undefined,
        jobType: debouncedFilters.jobType || undefined,
        status: debouncedFilters.status || undefined,
        limit,
        offset,
      }),
    refetchInterval: 30_000,
  });

  const total = jobRunsQuery.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <Layout
      user={user}
      title="Job runs"
      description="Worker execution history for polls, outbound email, and webhooks."
    >
      <div className={styles.adminPage}>
        <div className={styles.adminListHeader}>
          <p className={styles.sectionDescription}>
            Recent worker jobs, newest first. Refreshes every 30 seconds.
          </p>
        </div>

        <div className={styles.adminFilterRow}>
          <div className={styles.adminSearchField}>
            <Input
              label="Search"
              placeholder="Job type, project, team, or error…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.adminSearchField}>
            <Input
              label="Job type"
              placeholder="e.g. imap-poll-project"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            />
          </div>
          <div className={styles.adminSearchField}>
            <Input
              label="Status"
              placeholder="e.g. completed"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        </div>

        {jobRunsQuery.isLoading ? (
          <p className={styles.formHint}>Loading…</p>
        ) : jobRunsQuery.isError ? (
          <p className={styles.testError}>
            {jobRunsQuery.error instanceof Error
              ? jobRunsQuery.error.message
              : "Failed to load job runs"}
          </p>
        ) : (
          <JobRunsTable
            runs={jobRunsQuery.data?.runs ?? []}
            onShowDetails={setDetailsRun}
          />
        )}

        <JobRunDetailsDialog
          run={detailsRun}
          onClose={() => setDetailsRun(null)}
        />

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
