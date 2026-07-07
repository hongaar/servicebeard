import type { ProjectStatusEvent } from "../lib/api";
import { statusCategoryLabel, statusSeverityClass } from "../lib/statusEvents";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ProjectStatusEventDialogProps {
  event: ProjectStatusEvent | null;
  onClose: () => void;
  onDismiss: (eventId: string) => void;
  isDismissing?: boolean;
}

export function ProjectStatusEventDialog({
  event,
  onClose,
  onDismiss,
  isDismissing,
}: ProjectStatusEventDialogProps) {
  return (
    <Dialog
      open={event !== null}
      wide
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Status event details"
    >
      {event && (
        <>
          <div className={styles.statusEventDialogHeader}>
            <span
              className={[
                styles.badge,
                statusSeverityClass(event.severity),
              ].join(" ")}
            >
              {event.severity}
            </span>
            <span className={[styles.badge, styles.badgeInactive].join(" ")}>
              {statusCategoryLabel(event.category)}
            </span>
            <span className={styles.statusEventMeta}>
              {event.operation}
              {event.status != null ? ` · HTTP ${event.status}` : ""}
              {" · "}
              {new Date(event.createdAt).toLocaleString()}
            </span>
          </div>
          <p className={styles.statusEventMessage}>{event.message}</p>
          {event.responseBody && (
            <pre className={styles.statusEventBody}>{event.responseBody}</pre>
          )}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() => onDismiss(event.id)}
              disabled={isDismissing}
            >
              {isDismissing ? "Dismissing…" : "Dismiss"}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
