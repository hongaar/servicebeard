import type { LucideIcon } from "lucide-react";
import { iconLg } from "../lib/icons";
import styles from "../styles/pages.module.css";

interface EmptyIconProps {
  icon: LucideIcon;
}

export function EmptyIcon({ icon: Icon }: EmptyIconProps) {
  return (
    <span className={styles.emptyIcon} aria-hidden>
      <Icon {...iconLg} />
    </span>
  );
}
