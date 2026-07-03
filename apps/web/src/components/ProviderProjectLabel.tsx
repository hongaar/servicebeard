import type { ProviderProjectKind } from "@servicebeard/shared";
import { formatProviderProjectLabel } from "@servicebeard/shared";
import { ProviderLogo } from "./ProviderLogo";
import styles from "./ProviderProjectLabel.module.css";

interface ProviderProjectLabelProps {
  provider: string;
  providerProjectId: string;
  providerProjectLabel?: string;
  providerProjectKind?: ProviderProjectKind;
  className?: string;
  showLogo?: boolean;
}

export function ProviderProjectLabel({
  provider,
  providerProjectId,
  providerProjectLabel,
  providerProjectKind,
  className,
  showLogo = true,
}: ProviderProjectLabelProps) {
  const fallback = formatProviderProjectLabel(provider, providerProjectId);
  const label = providerProjectLabel ?? fallback.label;
  const kind = providerProjectKind ?? fallback.kind;
  const isLinear = provider.toLowerCase() === "linear";

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")}>
      {showLogo && <ProviderLogo provider={provider} />}
      {isLinear && kind ? (
        <span className={styles.kind} data-kind={kind}>
          {kind === "team" ? "Team" : "Project"}
        </span>
      ) : null}
      <span className={styles.label} title={label}>
        {label}
      </span>
    </span>
  );
}
