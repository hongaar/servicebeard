import { formatAddressList } from "@servicebeard/shared/mail";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, type ThreadDetail } from "../lib/api";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.debugField}>
      <dt className={styles.debugLabel}>{label}</dt>
      <dd className={styles.debugValue}>{value}</dd>
    </div>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatAddresses(addresses: string[]): string {
  return addresses.length > 0 ? formatAddressList(addresses) : "—";
}

function ThreadDetailContent({ thread }: { thread: ThreadDetail }) {
  return (
    <div className={styles.debugPanel}>
      <section className={styles.debugSection}>
        <h3 className={styles.debugSectionTitle}>Thread</h3>
        <dl className={styles.debugGrid}>
          <DetailField label="ID" value={<code>{thread.id}</code>} />
          <DetailField label="Project ID" value={<code>{thread.projectId}</code>} />
          <DetailField label="External issue ID" value={<code>{thread.externalIssueId}</code>} />
          <DetailField
            label="Issue"
            value={
              <a href={thread.issueUrl} target="_blank" rel="noreferrer">
                #{thread.issueIid}
              </a>
            }
          />
          <DetailField label="Subject (normalized)" value={thread.subjectNormalized} />
          <DetailField
            label="Original sender"
            value={
              thread.originalSenderName
                ? `${thread.originalSenderName} <${thread.originalSenderEmail}>`
                : thread.originalSenderEmail
            }
          />
          <DetailField label="Last seen note" value={formatTimestamp(thread.lastSeenNoteAt)} />
          <DetailField label="Created" value={formatTimestamp(thread.createdAt)} />
          <DetailField label="Updated" value={formatTimestamp(thread.updatedAt)} />
        </dl>
      </section>

      <section className={styles.debugSection}>
        <h3 className={styles.debugSectionTitle}>
          Messages ({thread.messages.length})
        </h3>
        {thread.messages.length === 0 ? (
          <p className={styles.formHint}>No messages recorded for this thread.</p>
        ) : (
          <div className={styles.debugMessageList}>
            {thread.messages.map((message, index) => (
              <article key={message.id} className={styles.debugMessageCard}>
                <div className={styles.debugMessageHeader}>
                  <span className={styles.debugMessageIndex}>#{index + 1}</span>
                  <span
                    className={[
                      styles.badge,
                      message.direction === "inbound"
                        ? styles.badgeInbound
                        : styles.badgeOutbound,
                    ].join(" ")}
                  >
                    {message.direction}
                  </span>
                  <span className={styles.ruleMeta}>
                    {formatTimestamp(message.processedAt)}
                  </span>
                </div>
                <dl className={styles.debugGrid}>
                  <DetailField label="ID" value={<code>{message.id}</code>} />
                  <DetailField label="Message-ID" value={<code>{message.messageId}</code>} />
                  <DetailField
                    label="In-Reply-To"
                    value={message.inReplyTo ? <code>{message.inReplyTo}</code> : "—"}
                  />
                  <DetailField
                    label="References"
                    value={
                      message.references.length ? (
                        <ul className={styles.debugList}>
                          {message.references.map((ref) => (
                            <li key={ref}>
                              <code>{ref}</code>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailField label="Subject" value={message.subject ?? "—"} />
                  <DetailField
                    label="From"
                    value={message.fromAddress ? <code>{message.fromAddress}</code> : "—"}
                  />
                  <DetailField label="To" value={formatAddresses(message.toAddresses)} />
                  <DetailField label="Cc" value={formatAddresses(message.ccAddresses)} />
                  <DetailField label="Bcc" value={formatAddresses(message.bccAddresses)} />
                  <DetailField
                    label="External note ID"
                    value={message.externalNoteId ? <code>{message.externalNoteId}</code> : "—"}
                  />
                </dl>
                <div className={styles.debugBody}>
                  <div className={styles.debugLabel}>Body</div>
                  <pre className={styles.debugBodyText}>
                    {message.bodyText?.trim() || "—"}
                  </pre>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface ThreadDetailDialogProps {
  teamId: string;
  projectId: string;
  threadId: string | null;
  issueLabel: string;
  onClose: () => void;
}

export function ThreadDetailDialog({
  teamId,
  projectId,
  threadId,
  issueLabel,
  onClose,
}: ThreadDetailDialogProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["thread", teamId, projectId, threadId],
    queryFn: () => api.getThread(teamId, projectId, threadId!),
    enabled: threadId !== null,
  });

  return (
    <Dialog
      open={threadId !== null}
      wide
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Thread details · ${issueLabel}`}
    >
      {isLoading && <p className={styles.formHint}>Loading thread details…</p>}
      {isError && (
        <div className={[styles.alert, styles.alertError].join(" ")}>
          {error instanceof Error ? error.message : "Failed to load thread"}
        </div>
      )}
      {data?.thread && <ThreadDetailContent thread={data.thread} />}
      <div className={styles.formActions}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
