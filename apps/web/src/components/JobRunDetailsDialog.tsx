import { Link } from "@tanstack/react-router";
import type { AdminJobRun } from "../lib/api";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

const JOB_TYPE_LABELS: Record<string, string> = {
  "imap-poll": "IMAP poll tick",
  "imap-poll-project": "IMAP poll",
  "comment-poll": "Comment poll tick",
  "comment-poll-project": "Comment poll",
  "send-email": "Send email",
  "ensure-webhook": "Ensure webhook",
};

const METADATA_LABELS: Record<string, string> = {
  scope: "Scope",
  phase: "Phase",
  operation: "Operation",
  projectId: "Project ID",
  projectName: "Project",
  projectSlug: "Project slug",
  teamId: "Team ID",
  teamName: "Team",
  teamSlug: "Team slug",
  provider: "Provider",
  activeProjects: "Active projects",
  enqueued: "Enqueued",
  skippedNotDue: "Skipped (not due)",
  skippedRateLimited: "Skipped (rate limited)",
  exhaustedBuckets: "Rate-limit buckets",
  noteId: "Note ID",
  source: "Source",
  bucketKey: "Rate-limit bucket",
  retryAt: "Retry at",
  reason: "Reason",
  errorName: "Error type",
  errorCode: "Error code",
  cause: "Cause",
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs: number | null): string {
  if (durationMs == null) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)} s`;
  return `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1000)}s`;
}

function statusClass(status: AdminJobRun["status"]): string {
  if (status === "completed") return styles.statusSeveritySuccess;
  if (status === "failed") return styles.statusSeverityError;
  if (status === "deferred" || status === "skipped")
    return styles.statusSeverityWarning;
  if (status === "running") return styles.statusSeverityInfo;
  return styles.badgeInactive;
}

function jobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] ?? jobType;
}

function resolveProjectContext(run: AdminJobRun) {
  const metadata = run.metadata ?? {};
  return {
    projectId:
      run.projectId ??
      (typeof metadata.projectId === "string" ? metadata.projectId : null),
    projectName:
      run.projectName ??
      (typeof metadata.projectName === "string" ? metadata.projectName : null),
    teamId:
      run.teamId ??
      (typeof metadata.teamId === "string" ? metadata.teamId : null),
    teamName:
      run.teamName ??
      (typeof metadata.teamName === "string" ? metadata.teamName : null),
    scope:
      typeof metadata.scope === "string"
        ? metadata.scope
        : run.projectId
          ? "project"
          : "platform",
  };
}

function formatMetadataValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (key === "retryAt" && typeof value === "string") {
    return formatTimestamp(value);
  }
  return String(value);
}

function metadataEntries(
  metadata: Record<string, unknown> | null,
): Array<{ key: string; label: string; value: string }> {
  if (!metadata) return [];

  const hidden = new Set(["stack", "projectId", "teamId"]);
  return Object.entries(metadata)
    .filter(([key, value]) => !hidden.has(key) && value != null && value !== "")
    .map(([key, value]) => ({
      key,
      label: METADATA_LABELS[key] ?? key,
      value: formatMetadataValue(key, value),
    }));
}

interface JobRunDetailsDialogProps {
  run: AdminJobRun | null;
  onClose: () => void;
}

export function JobRunDetailsDialog({
  run,
  onClose,
}: JobRunDetailsDialogProps) {
  const context = run ? resolveProjectContext(run) : null;
  const details = run ? metadataEntries(run.metadata) : [];
  const stack =
    run && typeof run.metadata?.stack === "string" ? run.metadata.stack : null;

  return (
    <Dialog
      open={run !== null}
      wide
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={run ? jobTypeLabel(run.jobType) : "Job run details"}
    >
      {run && context ? (
        <>
          <div className={styles.jobRunDialogHeader}>
            <span className={[styles.badge, statusClass(run.status)].join(" ")}>
              {run.status}
            </span>
            <code className={styles.jobRunDialogType}>{run.jobType}</code>
            <span className={styles.jobRunDialogMeta}>
              {formatDuration(run.durationMs)}
              {" · "}
              {formatTimestamp(run.startedAt)}
            </span>
          </div>

          <div className={styles.jobRunDialogContext}>
            {context.scope === "platform" ? (
              context.projectName ? (
                <span className={styles.adminMuted}>
                  Platform scheduler · failed while processing{" "}
                  <strong>{context.projectName}</strong>
                  {context.teamName ? ` (${context.teamName})` : ""}
                </span>
              ) : (
                <span
                  className={[styles.badge, styles.badgeInactive].join(" ")}
                >
                  Platform-wide scheduler
                </span>
              )
            ) : context.projectId && context.teamId ? (
              <Link
                to="/teams/$teamId/projects/$projectId/$section"
                params={{
                  teamId: context.teamId,
                  projectId: context.projectId,
                  section: "status",
                }}
                className={styles.tableRowLink}
              >
                {context.teamName ?? context.teamId} /{" "}
                {context.projectName ?? context.projectId}
              </Link>
            ) : (
              <span className={styles.adminMuted}>
                {context.projectName ?? context.projectId ?? "Unknown project"}
              </span>
            )}
          </div>

          {run.error ? (
            <div className={styles.jobRunErrorBox}>
              <p className={styles.jobRunErrorTitle}>Error</p>
              <p className={styles.jobRunErrorMessage}>{run.error}</p>
            </div>
          ) : null}

          {details.length > 0 ? (
            <dl className={styles.jobRunDetailsGrid}>
              {details.map((entry) => (
                <div key={entry.key} className={styles.jobRunDetailsRow}>
                  <dt className={styles.jobRunDetailsLabel}>{entry.label}</dt>
                  <dd className={styles.jobRunDetailsValue}>
                    {entry.key === "operation" || entry.key === "phase" ? (
                      <code>{entry.value}</code>
                    ) : (
                      entry.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {stack ? (
            <div className={styles.jobRunStackSection}>
              <p className={styles.jobRunStackTitle}>Stack trace</p>
              <pre className={styles.jobRunStackBody}>{stack}</pre>
            </div>
          ) : null}

          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

export function jobRunContextLabel(run: AdminJobRun): string {
  const context = resolveProjectContext(run);
  if (context.scope === "platform") {
    if (typeof run.metadata?.projectName === "string") {
      return `while scheduling ${run.metadata.projectName}`;
    }
    return "platform";
  }
  return context.projectName ?? context.projectId ?? "—";
}

export function jobRunStatusClass(status: AdminJobRun["status"]): string {
  if (status === "completed") return styles.testOk;
  if (status === "failed") return styles.testError;
  if (status === "deferred" || status === "skipped")
    return styles.statusSeverityWarning;
  if (status === "running") return styles.statusSeverityInfo;
  return styles.adminMuted;
}

export {
  formatDuration as formatJobRunDuration,
  formatTimestamp as formatJobRunTimestamp,
};
