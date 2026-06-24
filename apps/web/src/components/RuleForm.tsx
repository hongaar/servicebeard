import { evaluateDraftRule } from "@servicebeard/shared/rules";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
    api,
    type CreateRuleInput,
    type ProviderOptions,
} from "../lib/api";
import { iconSm } from "../lib/icons";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Card } from "./Card";
import { Checkbox, Input, Select } from "./Input";

interface RuleFormProps {
  teamId: string;
  projectId: string;
  initial?: CreateRuleInput;
  title: string;
  submitLabel: string;
  onSubmit: (data: CreateRuleInput) => void;
  isPending?: boolean;
  onCancel?: () => void;
  formError?: string;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (field: string) => void;
}

const emptyForm: CreateRuleInput = {
  name: "",
  priority: 0,
  isEnabled: true,
  matchSender: "",
  matchSubject: "",
  matchBody: "",
  actionCreateIssue: true,
  actionStatus: null,
  actionLabels: [],
  actionAssigneeId: null,
};

export function RuleForm({
  teamId,
  projectId,
  initial,
  title,
  submitLabel,
  onSubmit,
  isPending,
  onCancel,
  formError,
  fieldErrors,
  onClearFieldError,
}: RuleFormProps) {
  const [form, setForm] = useState<CreateRuleInput>({ ...emptyForm, ...initial });
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const providerOptions = useQuery({
    queryKey: ["provider-options", teamId, projectId],
    queryFn: () => api.getProviderOptions(teamId, projectId),
  });

  const mailboxSnapshot = useQuery({
    queryKey: ["mailbox-snapshot", teamId, projectId],
    queryFn: () => api.getMailboxSnapshot(teamId, projectId),
    enabled: previewExpanded,
    staleTime: 60_000,
  });

  const preview = useMemo(() => {
    if (!mailboxSnapshot.data) return null;

    const ruleInput = {
      matchSender: form.matchSender || null,
      matchSubject: form.matchSubject || null,
      matchBody: form.matchBody || null,
      isEnabled: form.isEnabled,
    };

    const results = mailboxSnapshot.data.messages.map((msg) => ({
      uid: msg.uid,
      fromEmail: msg.fromEmail,
      fromName: msg.fromName,
      subject: msg.subject,
      bodyPreview: msg.bodyPreview,
      date: msg.date,
      matched: evaluateDraftRule(ruleInput, {
        messageId: msg.messageId,
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        subject: msg.subject,
        body: msg.body,
        bodyMarkdown: msg.body,
        bodyHtml: null,
        inlineImages: [],
        date: msg.date ? new Date(msg.date) : new Date(0),
      }),
    }));

    return {
      results,
      matchedCount: results.filter((r) => r.matched).length,
      total: results.length,
    };
  }, [
    mailboxSnapshot.data,
    form.matchSender,
    form.matchSubject,
    form.matchBody,
    form.isEnabled,
  ]);

  const options: ProviderOptions | undefined = providerOptions.data;

  const statusSelectOptions = [
    { value: "", label: "No default status" },
    ...(options?.statuses.map((s) => ({ value: s.id, label: s.name })) ?? []),
  ];

  const assigneeSelectOptions = [
    { value: "", label: "Unassigned" },
    ...(options?.members.map((m) => ({
      value: m.id,
      label: m.name ? `${m.name} (@${m.username})` : `@${m.username}`,
    })) ?? []),
  ];

  const toggleLabel = (label: string) => {
    setForm((f) => {
      const current = f.actionLabels ?? [];
      const next = current.includes(label)
        ? current.filter((l) => l !== label)
        : [...current, label];
      return { ...f, actionLabels: next };
    });
  };

  const handleSubmit = () => {
    onSubmit({
      ...form,
      matchSender: form.matchSender || null,
      matchSubject: form.matchSubject || null,
      matchBody: form.matchBody || null,
      actionStatus: form.actionStatus || null,
      actionAssigneeId: form.actionAssigneeId || null,
    });
  };

  const previewSummary = preview
    ? `${preview.matchedCount} of ${preview.total} match`
    : mailboxSnapshot.isFetching
      ? "Loading…"
      : "Expand to preview";

  return (
    <Card title={title} className={styles.section}>
      <div className={styles.form}>
        {formError && (
          <div className={[styles.alert, styles.alertError].join(" ")}>{formError}</div>
        )}
        <Input
          label="Name"
          value={form.name}
          error={fieldErrors?.name}
          onChange={(e) => {
            onClearFieldError?.("name");
            setForm((f) => ({ ...f, name: e.target.value }));
          }}
        />
        <Checkbox
          label="Rule enabled"
          checked={form.isEnabled ?? true}
          onChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
        />
        <Input
          label="Match Sender (regex)"
          value={form.matchSender ?? ""}
          error={fieldErrors?.matchSender}
          onChange={(e) => {
            onClearFieldError?.("matchSender");
            setForm((f) => ({ ...f, matchSender: e.target.value }));
          }}
          hint="Leave empty to match any sender."
        />
        <Input
          label="Match Subject (regex)"
          value={form.matchSubject ?? ""}
          error={fieldErrors?.matchSubject}
          onChange={(e) => {
            onClearFieldError?.("matchSubject");
            setForm((f) => ({ ...f, matchSubject: e.target.value }));
          }}
          hint="Leave empty to match any subject."
        />
        <Input
          label="Match Body (regex)"
          value={form.matchBody ?? ""}
          error={fieldErrors?.matchBody}
          onChange={(e) => {
            onClearFieldError?.("matchBody");
            setForm((f) => ({ ...f, matchBody: e.target.value }));
          }}
          hint="Leave empty to match any body."
        />

        <div className={styles.collapseSection}>
          <button
            type="button"
            className={styles.collapseHeader}
            onClick={() => setPreviewExpanded((v) => !v)}
            aria-expanded={previewExpanded}
          >
            <span className={styles.collapseTitle}>Match preview</span>
            <span className={styles.collapseSummary}>{previewSummary}</span>
            <span className={styles.collapseChevron} data-expanded={previewExpanded}>
              <ChevronDown {...iconSm} />
            </span>
          </button>

          {previewExpanded && (
            <div className={styles.collapseBody}>
              <p className={styles.formHint}>
                Recent inbox messages are matched live as you edit the criteria above.
              </p>

              {mailboxSnapshot.isError && (
                <div className={[styles.alert, styles.alertError].join(" ")}>
                  {mailboxSnapshot.error instanceof Error
                    ? mailboxSnapshot.error.message
                    : "Failed to load mailbox"}
                </div>
              )}

              {mailboxSnapshot.isFetching && (
                <p className={styles.formHint}>Loading mailbox snapshot…</p>
              )}

              {preview && (
                <>
                  <div
                    className={[
                      styles.alert,
                      preview.matchedCount > 0 ? styles.alertSuccess : styles.alertError,
                    ].join(" ")}
                  >
                    {preview.matchedCount} of {preview.total} messages match
                  </div>
                  <div className={styles.previewTableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Subject</th>
                          <th>Sender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.results.map((r) => (
                          <tr key={r.uid}>
                            <td>
                              <span
                                className={[
                                  styles.badge,
                                  r.matched ? styles.badgeActive : styles.badgeInactive,
                                ].join(" ")}
                              >
                                {r.matched ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{r.subject}</td>
                            <td>
                              {r.fromName ? `${r.fromName} <${r.fromEmail}>` : r.fromEmail}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.formActions} style={{ justifyContent: "flex-start" }}>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => mailboxSnapshot.refetch()}
                      disabled={mailboxSnapshot.isFetching}
                    >
                      Refresh snapshot
                    </Button>
                  </div>
                </>
              )}

              {mailboxSnapshot.data && preview?.total === 0 && (
                <p className={styles.formHint}>No messages found in the inbox.</p>
              )}
            </div>
          )}
        </div>

        <div className={styles.sectionTitle}>Default issue settings</div>
        {providerOptions.isError && (
          <div className={[styles.alert, styles.alertError].join(" ")}>
            Could not load GitLab options:{" "}
            {providerOptions.error instanceof Error
              ? providerOptions.error.message
              : "Unknown error"}
          </div>
        )}
        <div className={styles.row}>
          <Select
            label="Default status"
            value={form.actionStatus ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, actionStatus: e.target.value || null }))
            }
            options={statusSelectOptions}
            disabled={providerOptions.isLoading}
          />
          <Select
            label="Default assignee"
            value={form.actionAssigneeId ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, actionAssigneeId: e.target.value || null }))
            }
            options={assigneeSelectOptions}
            disabled={providerOptions.isLoading}
          />
        </div>

        {providerOptions.isLoading ? (
          <p className={styles.formHint}>Loading labels from GitLab…</p>
        ) : options?.labels.length ? (
          <div>
            <div className={styles.sectionTitle}>Default labels</div>
            <div className={styles.labelGrid}>
              {options.labels.map((label) => (
                <label key={label.name} className={styles.labelOption}>
                  <input
                    type="checkbox"
                    checked={(form.actionLabels ?? []).includes(label.name)}
                    onChange={() => toggleLabel(label.name)}
                  />
                  <span
                    className={styles.labelSwatch}
                    style={label.color ? { backgroundColor: `#${label.color}` } : undefined}
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.formHint}>No labels found in the GitLab project.</p>
        )}

        <Checkbox
          label="Create issue when matched"
          checked={form.actionCreateIssue ?? true}
          onChange={(v) => setForm((f) => ({ ...f, actionCreateIssue: v }))}
        />

        <div className={styles.formActions}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
