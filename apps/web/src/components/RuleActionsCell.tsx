import { Loader2 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { ProviderOptions, Rule } from "../lib/api";
import { providerLabelTagVars } from "../lib/providerLabel";
import {
    resolveAssigneeName,
    resolveStatusName,
    ruleHasActions,
} from "../lib/ruleDisplay";
import labelStyles from "./ProviderLabelMultiSelect.module.css";
import styles from "./RuleActionsCell.module.css";

interface RuleActionsCellProps {
  rule: Rule;
  options?: ProviderOptions;
  optionsLoading?: boolean;
}

function ActionSpinner() {
  return (
    <Loader2
      size={14}
      className={styles.spinner}
      aria-hidden="true"
    />
  );
}

export function RuleActionsCell({ rule, options, optionsLoading }: RuleActionsCellProps) {
  if (!ruleHasActions(rule)) {
    return <span className={styles.empty}>—</span>;
  }

  const labelColorByName = new Map(
    options?.labels.map((label) => [label.name, label.color]) ?? [],
  );

  const parts: ReactNode[] = [];

  if (rule.actionStatus) {
    parts.push(
      <span key="status" className={styles.part}>
        <span className={styles.prefix}>status:</span>
        {optionsLoading ? (
          <ActionSpinner />
        ) : (
          resolveStatusName(rule.actionStatus, options)
        )}
      </span>,
    );
  }

  if (rule.actionLabels.length > 0) {
    parts.push(
      <span key="labels" className={styles.part}>
        <span className={styles.prefix}>labels:</span>
        <span className={styles.labels}>
          {rule.actionLabels.map((name) => (
            <span
              key={name}
              className={[labelStyles.tag, labelStyles.tagDisplay].join(" ")}
              style={providerLabelTagVars(labelColorByName.get(name) ?? null)}
            >
              {name}
            </span>
          ))}
        </span>
      </span>,
    );
  }

  if (rule.actionAssigneeId) {
    parts.push(
      <span key="assignee" className={styles.part}>
        <span className={styles.prefix}>assignee:</span>
        {optionsLoading ? (
          <ActionSpinner />
        ) : (
          resolveAssigneeName(rule.actionAssigneeId, options)
        )}
      </span>,
    );
  }

  return (
    <div
      className={styles.root}
      aria-busy={optionsLoading || undefined}
    >
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
          ) : null}
          {part}
        </Fragment>
      ))}
    </div>
  );
}
