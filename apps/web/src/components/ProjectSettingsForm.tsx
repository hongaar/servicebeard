import type { ProjectSettingsFormValues } from "../lib/projectForm";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Checkbox, Input, Textarea } from "./Input";

interface ProjectSettingsFormProps {
  mode: "create" | "edit";
  values: ProjectSettingsFormValues;
  onChange: (field: keyof ProjectSettingsFormValues, value: string | number | boolean) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  isPending?: boolean;
  fieldErrors?: Partial<Record<keyof ProjectSettingsFormValues, string>>;
  onClearFieldError?: (field: keyof ProjectSettingsFormValues) => void;
  webhookUrl?: string;
}

export function ProjectSettingsForm({
  mode,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
  fieldErrors,
  onClearFieldError,
  webhookUrl,
}: ProjectSettingsFormProps) {
  const isEdit = mode === "edit";

  const set =
    (field: keyof ProjectSettingsFormValues) => (value: string | number | boolean) => {
      onClearFieldError?.(field);
      onChange(field, value);
    };

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <Input
          label="Name"
          value={values.name}
          error={fieldErrors?.name}
          onChange={(e) => {
            set("name")(e.target.value);
            if (mode === "create") {
              set("slug")(
                e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
              );
            }
          }}
          hint="Display name for this project, e.g. “Acme Support”."
        />
        <Input
          label="Slug"
          value={values.slug}
          error={fieldErrors?.slug}
          onChange={(e) => set("slug")(e.target.value)}
          hint="Used in URLs. Lowercase letters, numbers and hyphens only."
        />
      </div>

      {isEdit && (
        <>
          <Checkbox
            label="Project active"
            checked={values.isActive}
            onChange={(v) => onChange("isActive", v)}
          />
          <Checkbox
            label="Webhook enabled"
            checked={values.webhookEnabled}
            onChange={(v) => onChange("webhookEnabled", v)}
            hint={
              <>
                <p>
                  When enabled, GitLab notifies this app about new issue comments so customer
                  replies are sent by email right away.
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  <strong>Setup</strong>
                </p>
                <ol style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                  <li>
                    Set the <code>WEBHOOK_BASE_URL</code> environment variable to the public URL
                    of your API (must be reachable from GitLab, not the web UI).
                  </li>
                  <li>
                    The webhook is registered in GitLab automatically when the project is
                    created. Check GitLab → Settings → Webhooks for a hook with{" "}
                    <strong>Note events</strong> enabled.
                  </li>
                  {webhookUrl && (
                    <li>
                      Expected URL: <code>{webhookUrl}</code>
                    </li>
                  )}
                </ol>
                <p style={{ marginTop: "0.5rem" }}>
                  Disable this if GitLab cannot reach your API. Comment polling below will still
                  sync replies, just more slowly.
                </p>
              </>
            }
          />
        </>
      )}

      <h3 className={styles.sectionTitle}>GitLab</h3>
      <p className={styles.formHint}>
        Connects this project to a GitLab repository so incoming emails become issues and replies
        sync as comments.
      </p>
      <div className={styles.row}>
        <Input
          label="Base URL"
          value={values.providerBaseUrl}
          error={fieldErrors?.providerBaseUrl}
          onChange={(e) => set("providerBaseUrl")(e.target.value)}
          hint={
            <>
              Root URL of your GitLab instance, <strong>not</strong> the API endpoint. Use{" "}
              <code>https://gitlab.com</code> for GitLab.com.
            </>
          }
        />
        <Input
          label="Project ID"
          value={values.providerProjectId}
          error={fieldErrors?.providerProjectId}
          onChange={(e) => set("providerProjectId")(e.target.value)}
          hint="Numeric project ID or path like group/project."
        />
      </div>
      <Input
        label="Access Token"
        type="password"
        value={values.providerToken}
        error={fieldErrors?.providerToken}
        onChange={(e) => set("providerToken")(e.target.value)}
        placeholder={isEdit ? "Leave blank to keep current token" : undefined}
        hint={
          isEdit ? (
            "Only fill in to replace the stored token."
          ) : (
            <>
              Token with the <code>api</code> scope to create issues and comments.
            </>
          )
        }
      />
      <Checkbox
        label="Skip TLS certificate verification (self-signed / custom CA)"
        checked={values.providerTlsInsecure}
        onChange={(v) => onChange("providerTlsInsecure", v)}
      />
      <Textarea
        label="Custom CA certificate (PEM, optional)"
        value={values.providerCaCert}
        error={fieldErrors?.providerCaCert}
        onChange={(e) => set("providerCaCert")(e.target.value)}
        placeholder={
          isEdit
            ? "Leave blank to keep current certificate. Paste a new PEM to replace."
            : "-----BEGIN CERTIFICATE-----..."
        }
      />

      <h3 className={styles.sectionTitle}>IMAP</h3>
      <p className={styles.formHint}>
        Inbox that is polled for incoming support emails.
      </p>
      <div className={styles.row}>
        <Input
          label="Host"
          value={values.imapHost}
          error={fieldErrors?.imapHost}
          onChange={(e) => set("imapHost")(e.target.value)}
        />
        <Input
          label="Port"
          type="number"
          value={values.imapPort}
          error={fieldErrors?.imapPort}
          onChange={(e) => set("imapPort")(Number(e.target.value))}
        />
      </div>
      <div className={styles.row}>
        <Input
          label="User"
          value={values.imapUser}
          error={fieldErrors?.imapUser}
          onChange={(e) => set("imapUser")(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          value={values.imapPassword}
          error={fieldErrors?.imapPassword}
          onChange={(e) => set("imapPassword")(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep current password" : undefined}
        />
      </div>
      <Checkbox
        label="IMAP TLS"
        checked={values.imapSecure}
        onChange={(v) => onChange("imapSecure", v)}
      />

      <h3 className={styles.sectionTitle}>SMTP</h3>
      <p className={styles.formHint}>Outgoing server used to send replies back to the customer.</p>
      <div className={styles.row}>
        <Input
          label="Host"
          value={values.smtpHost}
          error={fieldErrors?.smtpHost}
          onChange={(e) => set("smtpHost")(e.target.value)}
        />
        <Input
          label="Port"
          type="number"
          value={values.smtpPort}
          error={fieldErrors?.smtpPort}
          onChange={(e) => set("smtpPort")(Number(e.target.value))}
        />
      </div>
      <div className={styles.row}>
        <Input
          label="User"
          value={values.smtpUser}
          error={fieldErrors?.smtpUser}
          onChange={(e) => set("smtpUser")(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          value={values.smtpPassword}
          error={fieldErrors?.smtpPassword}
          onChange={(e) => set("smtpPassword")(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep current password" : undefined}
        />
      </div>
      <Input
        label="From Address"
        value={values.smtpFrom}
        error={fieldErrors?.smtpFrom}
        onChange={(e) => set("smtpFrom")(e.target.value)}
      />
      <Checkbox
        label="SMTP TLS"
        checked={values.smtpSecure}
        onChange={(v) => onChange("smtpSecure", v)}
      />

      <h3 className={styles.sectionTitle}>Sync</h3>
      <p className={styles.formHint}>
        How often the worker polls for new emails and GitLab comments.
      </p>
      <div className={styles.row}>
        <Input
          label="IMAP poll interval (seconds)"
          type="number"
          value={values.imapPollIntervalSeconds}
          error={fieldErrors?.imapPollIntervalSeconds}
          onChange={(e) => set("imapPollIntervalSeconds")(Number(e.target.value))}
          hint="Minimum 60 seconds (poll scheduler runs once per minute)."
        />
        <Input
          label="Comment poll interval (seconds)"
          type="number"
          value={values.commentPollIntervalSeconds}
          error={fieldErrors?.commentPollIntervalSeconds}
          onChange={(e) => set("commentPollIntervalSeconds")(Number(e.target.value))}
          hint="Fallback when webhooks are unavailable. Minimum 60 seconds (poll scheduler runs once per minute)."
        />
      </div>

      <h3 className={styles.sectionTitle}>Inbound email acknowledgement</h3>
      <p className={styles.formHint}>
        When a new issue is created from an incoming email, a reply is sent to the customer so it
        appears in their mailbox thread. Placeholders: {"{{senderName}}"}, {"{{senderEmail}}"},{" "}
        {"{{subject}}"}, {"{{issueNumber}}"}, {"{{issueUrl}}"}.
      </p>
      <Checkbox
        label="Send acknowledgement email for new issues"
        checked={values.inboundAckEnabled}
        onChange={(v) => onChange("inboundAckEnabled", v)}
      />
      <Textarea
        label="Acknowledgement template"
        value={values.inboundAckTemplate}
        error={fieldErrors?.inboundAckTemplate}
        onChange={(e) => set("inboundAckTemplate")(e.target.value)}
        rows={8}
        disabled={!values.inboundAckEnabled}
      />

      <div className={styles.formActions}>
        <Button onClick={onSubmit} disabled={isPending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
