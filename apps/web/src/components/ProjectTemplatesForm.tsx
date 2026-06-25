import {
    INBOUND_ACK_TEMPLATE_VARIABLES,
    INBOUND_COMMENT_TEMPLATE_VARIABLES,
    INBOUND_ISSUE_TEMPLATE_VARIABLES,
    OUTBOUND_COMMENT_TEMPLATE_VARIABLES,
} from "@servicebeard/shared";
import {
    TEMPLATE_DEFAULTS,
    type ProjectTemplatesFormValues,
    type TemplateField,
} from "../lib/projectTemplatesForm";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Checkbox, Textarea } from "./Input";

interface ProjectTemplatesFormProps {
  values: ProjectTemplatesFormValues;
  onChange: (field: keyof ProjectTemplatesFormValues, value: string | boolean) => void;
  onSubmit: () => void;
  submitLabel: string;
  isPending?: boolean;
  fieldErrors?: Partial<Record<keyof ProjectTemplatesFormValues, string>>;
  onClearFieldError?: (field: keyof ProjectTemplatesFormValues) => void;
}

function TemplateVariables({ variables }: { variables: readonly string[] }) {
  return (
    <p className={styles.templateVariables}>
      Variables:{" "}
      {variables.map((name, index) => (
        <span key={name}>
          {index > 0 && ", "}
          <code>{`{{${name}}}`}</code>
        </span>
      ))}
    </p>
  );
}

interface TemplateTextareaProps {
  field: TemplateField;
  label: string;
  value: string;
  variables: readonly string[];
  rows: number;
  hint?: string;
  disabled?: boolean;
  error?: string;
  onChange: (field: TemplateField, value: string) => void;
}

function TemplateTextarea({
  field,
  label,
  value,
  variables,
  rows,
  hint,
  disabled,
  error,
  onChange,
}: TemplateTextareaProps) {
  const defaultTemplate = TEMPLATE_DEFAULTS[field];
  const isDefault = value === defaultTemplate;

  return (
    <>
      <Textarea
        label={label}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        rows={rows}
        hint={hint}
        disabled={disabled}
        error={error}
        labelAction={
          <Button
            type="button"
            variant="ghost"
            size="small"
            disabled={disabled || isDefault}
            onClick={() => onChange(field, defaultTemplate)}
          >
            Restore default
          </Button>
        }
      />
      <TemplateVariables variables={variables} />
    </>
  );
}

export function ProjectTemplatesForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  isPending,
  fieldErrors,
  onClearFieldError,
}: ProjectTemplatesFormProps) {
  const handleChange = (field: keyof ProjectTemplatesFormValues, value: string | boolean) => {
    onChange(field, value);
    onClearFieldError?.(field);
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (isPending) return;
        onSubmit();
      }}
    >
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Acknowledgement emails</h3>
        <p className={styles.templateSectionLead}>
          Sent automatically when a new customer email creates an issue.
        </p>
        <Checkbox
          label="Send acknowledgement emails"
          checked={values.inboundAckEnabled}
          onChange={(v) => handleChange("inboundAckEnabled", v)}
          hint="When enabled, customers receive a confirmation email with the issue number and link."
        />
        <Checkbox
          label="CC support mailbox"
          checked={values.inboundAckCcMailbox}
          onChange={(v) => handleChange("inboundAckCcMailbox", v)}
          disabled={!values.inboundAckEnabled}
          hint="When enabled, a copy of each acknowledgement is sent to the project's From address so it appears in the support inbox."
        />
        <TemplateTextarea
          field="inboundAckTemplate"
          label="Acknowledgement template"
          value={values.inboundAckTemplate}
          onChange={handleChange}
          rows={8}
          disabled={!values.inboundAckEnabled}
          error={fieldErrors?.inboundAckTemplate}
          variables={INBOUND_ACK_TEMPLATE_VARIABLES}
        />
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Comment reply emails</h3>
        <p className={styles.templateSectionLead}>
          Sent to the customer when your team posts a public comment on the linked issue.
        </p>
        <Checkbox
          label="CC support mailbox"
          checked={values.outboundCommentCcMailbox}
          onChange={(v) => handleChange("outboundCommentCcMailbox", v)}
          hint="When enabled, a copy of each comment reply is sent to the project's From address so the full conversation stays in the support inbox."
        />
        <TemplateTextarea
          field="outboundCommentTemplate"
          label="Reply email template"
          value={values.outboundCommentTemplate}
          onChange={handleChange}
          rows={8}
          error={fieldErrors?.outboundCommentTemplate}
          variables={OUTBOUND_COMMENT_TEMPLATE_VARIABLES}
        />
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Issue tracker templates</h3>
        <p className={styles.templateSectionLead}>
          Controls how customer emails appear as issues and comments in your tracker. ServiceBeard
          appends sync metadata automatically.
        </p>
        <TemplateTextarea
          field="inboundIssueTemplate"
          label="New issue template"
          value={values.inboundIssueTemplate}
          onChange={handleChange}
          rows={6}
          hint="Used when a new customer email creates an issue."
          error={fieldErrors?.inboundIssueTemplate}
          variables={INBOUND_ISSUE_TEMPLATE_VARIABLES}
        />
        <TemplateTextarea
          field="inboundCommentTemplate"
          label="Customer reply template"
          value={values.inboundCommentTemplate}
          onChange={handleChange}
          rows={6}
          hint="Used when a customer replies to an existing thread."
          error={fieldErrors?.inboundCommentTemplate}
          variables={INBOUND_COMMENT_TEMPLATE_VARIABLES}
        />
      </div>

      <div className={styles.formActions}>
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
