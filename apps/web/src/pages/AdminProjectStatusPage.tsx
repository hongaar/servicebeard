import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Layout } from "../components/Layout";
import { ProjectStatusEventDialog } from "../components/ProjectStatusEventDialog";
import { TableRowAction } from "../components/TableRowAction";
import { api, type AdminStatusEvent } from "../lib/api";
import { statusSeverityClass } from "../lib/statusEvents";
import styles from "../styles/pages.module.css";

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
            section: "status",
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

export function AdminProjectStatusPage() {
  const { user } = useLoaderData({ from: "/admin/project-status" });
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const limit = 50;

  const eventsQuery = useQuery({
    queryKey: ["admin-project-status", offset],
    queryFn: () => api.listAdminStatusEvents({ limit, offset }),
  });

  const dismissEvent = useMutation({
    mutationFn: (eventId: string) => api.dismissAdminStatusEvent(eventId),
    onSuccess: () => {
      setSelectedEventId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-project-status"] });
    },
  });

  const events = eventsQuery.data?.events ?? [];
  const total = eventsQuery.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <Layout
      title="Project status"
      description="Active mailbox and issue provider sync events across all projects."
      user={user}
    >
      <div className={styles.adminPage}>
        <div className={styles.adminListHeader}>
          <p className={styles.sectionDescription}>
            Unresolved sync errors and warnings, newest first.
          </p>
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
    </Layout>
  );
}
