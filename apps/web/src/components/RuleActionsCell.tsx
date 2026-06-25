import type { ReactNode } from "react";
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
}

export function RuleActionsCell({ rule, options }: RuleActionsCellProps) {
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
        <span className={styles.prefix}>status:</span>{" "}
        {resolveStatusName(rule.actionStatus, options)}
      </span>,
    );
  }

  if (rule.actionLabels.length > 0) {
    parts.push(
      <span key="labels" className={styles.part}>
        <span className={styles.prefix}>labels:</span>{" "}
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
        <span className={styles.prefix}>assignee:</span>{" "}
        {resolveAssigneeName(rule.actionAssigneeId, options)}
      </span>,
    );
  }

  return (
    <div className={styles.root}>
      {parts.map((part, index) => (
        <span key={index} className={styles.segment}>
          {index > 0 ? <span className={styles.sep}>·</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}
