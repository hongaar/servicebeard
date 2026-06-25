import type { ProjectSyncError } from "../lib/api";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

function syncErrorCategoryLabel(category: ProjectSyncError["category"]): string {
  return category === "mail" ? "Mailbox" : "Issue provider";
}

interface SyncErrorDetailDialogProps {
  error: ProjectSyncError | null;
  onClose: () => void;
  onDismiss: (errorId: string) => void;
  isDismissing?: boolean;
}

export function SyncErrorDetailDialog({
  error,
  onClose,
  onDismiss,
  isDismissing,
}: SyncErrorDetailDialogProps) {
  return (
    <Dialog
      open={error !== null}
      wide
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Sync error details"
    >
      {error && (
        <>
          <div className={styles.syncErrorDialogHeader}>
            <span className={[styles.badge, styles.badgeInactive].join(" ")}>
              {syncErrorCategoryLabel(error.category)}
            </span>
            <span className={styles.syncErrorMeta}>
              {error.operation}
              {error.status != null ? ` · HTTP ${error.status}` : ""}
              {" · "}
              {new Date(error.createdAt).toLocaleString()}
            </span>
          </div>
          <p className={styles.syncErrorMessage}>{error.message}</p>
          {error.responseBody && (
            <pre className={styles.syncErrorBody}>{error.responseBody}</pre>
          )}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() => onDismiss(error.id)}
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
