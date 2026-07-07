import styles from "../styles/pages.module.css";
import type { ProjectStatusEvent } from "./api";

export function statusCategoryLabel(
  category: ProjectStatusEvent["category"],
): string {
  return category === "mail" ? "Mailbox" : "Issue provider";
}

export function statusSeverityClass(
  severity: ProjectStatusEvent["severity"],
): string {
  if (severity === "warning") return styles.statusSeverityWarning;
  if (severity === "info") return styles.statusSeverityInfo;
  if (severity === "success") return styles.statusSeveritySuccess;
  return styles.statusSeverityError;
}
