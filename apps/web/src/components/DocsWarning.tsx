import { AlertTriangle } from "lucide-react";
import { iconMd } from "../lib/icons";
import styles from "../styles/docs.module.css";

export function DocsWarning({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={styles.calloutWarning}
      role="note"
      aria-label={title}
    >
      <AlertTriangle
        {...iconMd}
        className={styles.calloutWarningIcon}
        aria-hidden
      />
      <div>
        <p className={styles.calloutWarningTitle}>{title}</p>
        <div className={styles.calloutWarningBody}>{children}</div>
      </div>
    </div>
  );
}
