import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { ProjectStatusEventDialog } from "../components/ProjectStatusEventDialog";
import { TableRowAction } from "../components/TableRowAction";
import {
  api,
  type AdminCheckResult,
  type AdminStatusEvent,
  type AdminStatusResponse,
  type ProjectStatusEvent,
} from "../lib/api";
import { iconMd } from "../lib/icons";
import styles from "../styles/pages.module.css";

const CATEGORY_LABELS: Record<AdminCheckResult["category"], string> = {
  service: "Services",
  mail: "Mail connectivity",
  git: "Issue providers",
};

const CATEGORY_ORDER: AdminCheckResult["category"][] = [
  "service",
  "mail",
  "git",
];

function CheckRow({ check }: { check: AdminCheckResult }) {
  return (
    <div className={styles.adminCheckRow}>
      <div className={styles.adminCheckLabel}>
        {check.ok ? (
          <CheckCircle2 size={16} className={styles.adminCheckIconOk} />
        ) : (
          <XCircle size={16} className={styles.adminCheckIconError} />
        )}
        <span>{check.label}</span>
      </div>
      <div className={styles.adminCheckMeta}>
        {check.latencyMs != null && <span>{check.latencyMs} ms</span>}
        {check.detail && (
          <span className={styles.adminCheckDetail}>{check.detail}</span>
        )}
        {check.error && (
          <span className={styles.adminCheckError}>{check.error}</span>
        )}
      </div>
    </div>
  );
}

function StatusSummary({ status }: { status: AdminStatusResponse }) {
  return (
    <div className={styles.adminSummary}>
      {status.ok ? (
        <span className={styles.testOk}>
          <CheckCircle2 size={18} /> All checks passed
        </span>
      ) : (
        <span className={styles.testError}>
          <XCircle size={18} />{" "}
          {status.checks.filter((check) => !check.ok).length} check
          {status.checks.filter((check) => !check.ok).length === 1
            ? ""
            : "s"}{" "}
          failed
        </span>
      )}
      <span className={styles.adminCheckedAt}>
        Last run {new Date(status.checkedAt).toLocaleString()}
      </span>
    </div>
  );
}

function statusSeverityClass(severity: ProjectStatusEvent["severity"]) {
  if (severity === "warning") return styles.statusSeverityWarning;
  if (severity === "info") return styles.statusSeverityInfo;
  return styles.statusSeverityError;
}

function AdminStatusEventsSection() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const limit = 50;

  const eventsQuery = useQuery({
    queryKey: ["admin-status-events", offset],
    queryFn: () => api.listAdminStatusEvents({ limit, offset }),
  });

  const dismissEvent = useMutation({
    mutationFn: (eventId: string) => api.dismissAdminStatusEvent(eventId),
    onSuccess: () => {
      setSelectedEventId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-status-events"] });
    },
  });

  const events = eventsQuery.data?.events ?? [];
  const total = eventsQuery.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          <h2 className={styles.sectionTitle}>Sync events</h2>
          <p className={styles.sectionDescription}>
            Active mailbox and issue provider status events across all projects.
          </p>
        </div>
      </div>

      {eventsQuery.isLoading ? (
        <p className={styles.formHint}>Loading events…</p>
      ) : eventsQuery.isError ? (
        <p className={styles.testError}>
          <XCircle size={16} />{" "}
          {eventsQuery.error instanceof Error
            ? eventsQuery.error.message
            : "Failed to load events"}
        </p>
      ) : events.length === 0 ? (
        <p className={styles.formHint}>No active status events.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Operation</th>
                  <th>Message</th>
                  <th>Team / Project</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <StatusEventRow
                    key={event.id}
                    event={event}
                    onSelect={() => setSelectedEventId(event.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.adminPagination}>
            <span>
              {total === 0
                ? "No results"
                : `${pageStart}–${pageEnd} of ${total}`}
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

          <ProjectStatusEventDialog
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
            onDismiss={(eventId) => dismissEvent.mutate(eventId)}
            isDismissing={dismissEvent.isPending}
          />
        </>
      )}
    </div>
  );
}

function StatusEventRow({
  event,
  onSelect,
}: {
  event: AdminStatusEvent;
  onSelect: () => void;
}) {
  return (
    <tr
      className={styles.tableRowClickable}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View status event: ${event.operation}`}
    >
      <td>
        <span
          className={[styles.badge, statusSeverityClass(event.severity)].join(
            " ",
          )}
        >
          {event.severity}
        </span>
      </td>
      <td>
        {event.operation}
        {event.status != null ? ` · HTTP ${event.status}` : ""}
      </td>
      <td className={styles.tableCellTruncate}>{event.message}</td>
      <td>
        <Link
          to="/teams/$teamId/projects/$projectId/$section"
          params={{
            teamId: event.teamId,
            projectId: event.projectId,
            section: "overview",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {event.teamName} / {event.projectName}
        </Link>
      </td>
      <td>{new Date(event.createdAt).toLocaleString()}</td>
      <td className={styles.tableActions}>
        <TableRowAction
          label="Details"
          onActivate={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        />
      </td>
    </tr>
  );
}

export function AdminStatusPage() {
  const { user } = useLoaderData({ from: "/admin/status" });
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => api.getAdminStatus(),
    refetchOnWindowFocus: false,
  });

  const runChecks = useMutation({
    mutationFn: () => api.runAdminStatusChecks(),
    onSuccess: (status) => {
      queryClient.setQueryData(["admin-status"], { status });
    },
  });

  const status = statusQuery.data?.status ?? null;

  const checksByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    checks: status?.checks.filter((check) => check.category === category) ?? [],
  }));

  return (
    <Layout
      title="System status"
      description="Local services and outbound access required for mailbox sync and issue providers."
      user={user}
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderText}>
            <h2 className={styles.sectionTitle}>Health checks</h2>
            <p className={styles.sectionDescription}>
              Checks local services and outbound access required for mailbox
              sync and issue providers. Mail port probes use Gmail as a
              well-known target; failures usually mean egress restrictions on
              SMTP/IMAP.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => runChecks.mutate()}
            disabled={runChecks.isPending}
          >
            {runChecks.isPending ? (
              <>
                <Loader2 {...iconMd} className={styles.spinIcon} /> Running…
              </>
            ) : (
              <>
                <RefreshCw {...iconMd} /> Run checks
              </>
            )}
          </Button>
        </div>

        {statusQuery.isLoading && (
          <p className={styles.formHint}>Loading last status…</p>
        )}

        {statusQuery.isError && (
          <p className={styles.testError}>
            <XCircle size={16} />{" "}
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Failed to load status"}
          </p>
        )}

        {runChecks.isError && (
          <p className={styles.testError}>
            <XCircle size={16} />{" "}
            {runChecks.error instanceof Error
              ? runChecks.error.message
              : "Checks failed"}
          </p>
        )}

        {!statusQuery.isLoading && !status && !runChecks.isPending && (
          <p className={styles.formHint}>No checks have been run yet.</p>
        )}

        {status && (
          <>
            <StatusSummary status={status} />
            {checksByCategory.map(({ category, label, checks }) =>
              checks.length > 0 ? (
                <Card
                  key={category}
                  title={label}
                  className={styles.adminCheckCard}
                >
                  <div className={styles.adminCheckList}>
                    {checks.map((check) => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </div>
                </Card>
              ) : null,
            )}
          </>
        )}
      </div>

      <AdminStatusEventsSection />
    </Layout>
  );
}
