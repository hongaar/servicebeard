import type { ProjectSettingsFormValues } from "../lib/projectForm";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import {
    ProjectEditOptionsSection,
    ProjectMailSection,
    ProjectNameSection,
    ProjectProviderSection,
} from "./ProjectFormSections";

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
  teamId: string;
  projectId?: string;
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
  teamId,
  projectId,
}: ProjectSettingsFormProps) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (isPending) return;
        onSubmit();
      }}
    >
      <ProjectNameSection
        mode={mode}
        values={values}
        onChange={onChange}
        fieldErrors={fieldErrors}
        onClearFieldError={onClearFieldError}
      />

      <ProjectMailSection
        mode={mode}
        teamId={teamId}
        projectId={projectId}
        values={values}
        onChange={onChange}
        fieldErrors={fieldErrors}
        onClearFieldError={onClearFieldError}
      />

      <ProjectProviderSection
        mode={mode}
        teamId={teamId}
        projectId={projectId}
        values={values}
        onChange={onChange}
        fieldErrors={fieldErrors}
        onClearFieldError={onClearFieldError}
      />

      {mode === "edit" && (
        <>
          <ProjectEditOptionsSection values={values} onChange={onChange} />
        </>
      )}

      <div className={styles.formActions}>
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
