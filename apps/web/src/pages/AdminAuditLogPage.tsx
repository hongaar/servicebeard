import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Input } from "../components/Input";
import { Layout } from "../components/Layout";
import { api, type AdminAuditLogEntry } from "../lib/api";
import styles from "../styles/pages.module.css";

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

function hasMetadata(metadata: Record<string, unknown> | null): boolean {
  return !!metadata && Object.keys(metadata).length > 0;
}

const DETAILS_PREVIEW_MAX_LENGTH = 20;

function formatMetadataPreview(metadata: Record<string, unknown> | null): string {
  if (!hasMetadata(metadata)) {
    return "—";
  }
  try {
    const full = JSON.stringify(metadata);
    if (full.length <= DETAILS_PREVIEW_MAX_LENGTH) {
      return full;
    }
    return `${full.slice(0, DETAILS_PREVIEW_MAX_LENGTH)}…`;
  } catch {
    return "—";
  }
}

function formatMetadataJson(metadata: Record<string, unknown> | null): string {
  if (!hasMetadata(metadata)) {
    return "";
  }
  return JSON.stringify(metadata, null, 2);
}

function AuditLogDetailsDialog({
  entry,
  onClose,
}: {
  entry: AdminAuditLogEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={entry !== null}
      wide
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={entry ? `${entry.action} details` : "Audit log details"}
    >
      {entry && (
        <>
          <dl className={styles.debugGrid}>
            <dt className={styles.debugLabel}>Time</dt>
            <dd className={styles.debugValue}>{formatTimestamp(entry.createdAt)}</dd>
            <dt className={styles.debugLabel}>Action</dt>
            <dd className={styles.debugValue}>
              <code>{entry.action}</code>
            </dd>
            <dt className={styles.debugLabel}>Resource</dt>
            <dd className={styles.debugValue}>
              <code>{entry.resourceType}</code>
              {entry.resourceId ? (
                <>
                  {" · "}
                  <code>{entry.resourceId}</code>
                </>
              ) : null}
            </dd>
            <dt className={styles.debugLabel}>Team</dt>
            <dd className={styles.debugValue}>
              {entry.teamName ?? entry.teamId ?? "—"}
            </dd>
            <dt className={styles.debugLabel}>User</dt>
            <dd className={styles.debugValue}>
              {entry.userEmail ?? entry.userName ?? entry.userId ?? "—"}
            </dd>
          </dl>
          {hasMetadata(entry.metadata) ? (
            <pre className={styles.adminAuditLogJson}>{formatMetadataJson(entry.metadata)}</pre>
          ) : (
            <p className={styles.formHint}>No additional details recorded.</p>
          )}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function AuditLogTable({
  entries,
  onShowDetails,
}: {
  entries: AdminAuditLogEntry[];
  onShowDetails: (entry: AdminAuditLogEntry) => void;
}) {
  if (entries.length === 0) {
    return <p className={styles.formHint}>No audit log entries match your filters.</p>;
  }

  return (
    <div className={[styles.tableWrap, styles.adminAuditLogTableWrap].join(" ")}>
      <table className={[styles.table, styles.adminAuditLogTable].join(" ")}>
        <thead>
          <tr>
            <th className={styles.adminAuditLogCompactCell}>Time</th>
            <th className={styles.adminAuditLogCompactCell}>Action</th>
            <th className={styles.adminAuditLogCompactCell}>Resource</th>
            <th className={styles.adminAuditLogCompactCell}>Team</th>
            <th className={styles.adminAuditLogCompactCell}>User</th>
            <th className={styles.adminAuditLogDetailsCol}>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className={[styles.adminAuditLogCompactCell, styles.adminMuted].join(" ")}>
                {formatTimestamp(entry.createdAt)}
              </td>
              <td className={styles.adminAuditLogCompactCell}>
                <code>{entry.action}</code>
              </td>
              <td className={styles.adminAuditLogCompactCell}>
                <div>
                  <code>{entry.resourceType}</code>
                </div>
                {entry.resourceId && (
                  <div className={styles.adminMuted}>
                    <code>{entry.resourceId}</code>
                  </div>
                )}
              </td>
              <td className={styles.adminAuditLogCompactCell}>
                {entry.teamId ? (
                  <Link
                    to="/teams/$teamId/projects"
                    params={{ teamId: entry.teamId }}
                    className={styles.tableRowLink}
                  >
                    {entry.teamName ?? entry.teamId}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={[styles.adminAuditLogCompactCell, styles.adminMuted].join(" ")}>
                {entry.userEmail ?? entry.userName ?? (entry.userId ? entry.userId : "—")}
              </td>
              <td className={styles.adminAuditLogDetailsCol}>
                {hasMetadata(entry.metadata) ? (
                  <div className={styles.adminAuditLogDetailsCell}>
                    <code>{formatMetadataPreview(entry.metadata)}</code>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onShowDetails(entry)}
                    >
                      Show
                    </Button>
                  </div>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAuditLogPage() {
  const { user } = useLoaderData({ from: "/admin/audit-log" });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [debouncedFilters, setDebouncedFilters] = useState({
    search: "",
    action: "",
    resourceType: "",
  });
  const [offset, setOffset] = useState(0);
  const [detailsEntry, setDetailsEntry] = useState<AdminAuditLogEntry | null>(null);
  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({
        search: search.trim(),
        action: action.trim(),
        resourceType: resourceType.trim(),
      });
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, action, resourceType]);

  const auditLogQuery = useQuery({
    queryKey: ["admin-audit-log", debouncedFilters, offset],
    queryFn: () =>
      api.listAuditLog({
        search: debouncedFilters.search || undefined,
        action: debouncedFilters.action || undefined,
        resourceType: debouncedFilters.resourceType || undefined,
        limit,
        offset,
      }),
  });

  const total = auditLogQuery.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <Layout
      user={user}
      title="Audit log"
      description="Platform-wide activity log for teams, billing, projects, and authentication."
    >
      <div className={styles.adminPage}>
        <div className={styles.adminListHeader}>
          <p className={styles.sectionDescription}>
            Recent actions across the platform, newest first.
          </p>
        </div>

        <div className={styles.adminFilterRow}>
          <div className={styles.adminSearchField}>
            <Input
              label="Search"
              placeholder="Action, resource, team, or user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.adminSearchField}>
            <Input
              label="Action"
              placeholder="e.g. payment_received"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <div className={styles.adminSearchField}>
            <Input
              label="Resource type"
              placeholder="e.g. subscription"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            />
          </div>
        </div>

        {auditLogQuery.isLoading ? (
          <p className={styles.formHint}>Loading…</p>
        ) : auditLogQuery.isError ? (
          <p className={styles.testError}>
            {auditLogQuery.error instanceof Error
              ? auditLogQuery.error.message
              : "Failed to load audit log"}
          </p>
        ) : (
          <AuditLogTable
            entries={auditLogQuery.data?.entries ?? []}
            onShowDetails={setDetailsEntry}
          />
        )}

        <AuditLogDetailsDialog entry={detailsEntry} onClose={() => setDetailsEntry(null)} />

        <div className={styles.adminPagination}>
          <span>{total === 0 ? "No results" : `${pageStart}–${pageEnd} of ${total}`}</span>
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
