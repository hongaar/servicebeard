import { Github, Gitlab } from "lucide-react";
import { iconMd } from "../lib/icons";
import styles from "./ProviderLogo.module.css";

interface ProviderLogoProps {
  provider: string;
}

export function ProviderLogo({ provider }: ProviderLogoProps) {
  const normalized = provider.toLowerCase();

  if (normalized === "gitlab") {
    return (
      <span className={styles.wrap}>
        <Gitlab {...iconMd} className={styles.gitlab} />
      </span>
    );
  }

  if (normalized === "github") {
    return (
      <span className={styles.wrap}>
        <Github {...iconMd} className={styles.github} />
      </span>
    );
  }

  return <span className={styles.fallback}>{provider}</span>;
}
