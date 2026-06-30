import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { ProjectSettingsFormValues } from "../lib/projectForm";
import { githubProviderCredentialsReady, normalizeProviderStepValues } from "../lib/projectForm";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import {
    ProjectMailSection,
    ProjectNameSection,
    ProjectProviderSection,
} from "./ProjectFormSections";

const STEPS = [
  { id: "name", title: "Name", description: "What should we call this project?" },
  { id: "mail", title: "Mailbox", description: "Connect your support inbox" },
  { id: "provider", title: "Issues", description: "Link your issue board" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface CreateProjectWizardProps {
  teamId: string;
  values: ProjectSettingsFormValues;
  onChange: (field: keyof ProjectSettingsFormValues, value: string | number | boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isPending?: boolean;
  fieldErrors?: Partial<Record<keyof ProjectSettingsFormValues, string>>;
  onClearFieldError?: (field: keyof ProjectSettingsFormValues) => void;
  initialStepIndex?: number;
  githubAppEnabled?: boolean;
}

function canAdvance(
  step: StepId,
  values: ProjectSettingsFormValues,
  githubAppEnabled = false,
): boolean {
  const providerValues = step === "provider" ? normalizeProviderStepValues(values) : values;
  switch (step) {
    case "name":
      return values.name.trim().length > 0;
    case "mail":
      return (
        values.smtpFrom.trim().length > 0 &&
        values.imapHost.trim().length > 0 &&
        values.imapUser.trim().length > 0 &&
        values.imapPassword.length > 0 &&
        values.smtpHost.trim().length > 0 &&
        values.smtpUser.trim().length > 0 &&
        values.smtpPassword.length > 0
      );
    case "provider":
      return (
        (providerValues.provider === "gitlab" ||
          providerValues.provider === "github" ||
          providerValues.provider === "linear") &&
        providerValues.providerBaseUrl.trim().length > 0 &&
        providerValues.providerProjectId.trim().length > 0 &&
        githubProviderCredentialsReady(providerValues, githubAppEnabled)
      );
  }
}

export function CreateProjectWizard({
  teamId,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
  fieldErrors,
  onClearFieldError,
  initialStepIndex = 0,
  githubAppEnabled = false,
}: CreateProjectWizardProps) {
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [maxReached, setMaxReached] = useState(initialStepIndex);
  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;
  const valuesForStep = step.id === "provider" ? normalizeProviderStepValues(values) : values;
  const canContinue = canAdvance(step.id, valuesForStep, githubAppEnabled);

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const goToStep = (index: number) => {
    if (isPending || index > maxReached) return;
    setStepIndex(index);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valuesForStep = values;
    if (step.id === "provider") {
      valuesForStep = normalizeProviderStepValues(values);
      for (const [key, val] of Object.entries(valuesForStep)) {
        const field = key as keyof ProjectSettingsFormValues;
        if (values[field] !== val) {
          onChange(field, val as string | number | boolean);
        }
      }
    }
    if (!canAdvance(step.id, valuesForStep, githubAppEnabled) || isPending) return;
    if (isLast) {
      onSubmit();
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
  };

  return (
    <form className={styles.wizard} onSubmit={handleFormSubmit}>
      <nav className={styles.wizardSteps} aria-label="Project setup steps">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          const open = i <= maxReached;
          return (
            <button
              key={s.id}
              type="button"
              className={[
                styles.wizardStep,
                styles.wizardStepButton,
                done ? styles.wizardStepDone : "",
                current ? styles.wizardStepCurrent : "",
                open ? styles.wizardStepOpen : styles.wizardStepLocked,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => goToStep(i)}
              disabled={!open || isPending}
              aria-current={current ? "step" : undefined}
            >
              <span className={styles.wizardStepNumber}>{done ? "✓" : i + 1}</span>
              <span className={styles.wizardStepText}>
                <span className={styles.wizardStepTitle}>{s.title}</span>
                <span className={styles.wizardStepDescription}>{s.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className={styles.wizardPanel}>
        {step.id === "name" && (
          <ProjectNameSection
            mode="create"
            values={values}
            onChange={onChange}
            fieldErrors={fieldErrors}
            onClearFieldError={onClearFieldError}
          />
        )}
        {step.id === "mail" && (
          <ProjectMailSection
            mode="create"
            teamId={teamId}
            values={values}
            onChange={onChange}
            fieldErrors={fieldErrors}
            onClearFieldError={onClearFieldError}
          />
        )}
        {step.id === "provider" && (
          <ProjectProviderSection
            mode="create"
            teamId={teamId}
            values={values}
            onChange={onChange}
            fieldErrors={fieldErrors}
            onClearFieldError={onClearFieldError}
          />
        )}
      </div>

      <div className={styles.formActions}>
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={goBack} disabled={isPending}>
            <ArrowLeft size={16} /> Back
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}

        <Button type="submit" disabled={!canContinue || isPending}>
          {isLast ? (
            submitLabel
          ) : (
            <>
              Continue <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
