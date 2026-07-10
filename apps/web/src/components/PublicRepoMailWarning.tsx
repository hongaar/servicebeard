import { AlertTriangle } from "lucide-react";
import { DOC_PATHS } from "../lib/docs";
import { iconMd } from "../lib/icons";
import styles from "../styles/pages.module.css";
import { DocsLink } from "./DocsLink";

export function PublicRepoMailWarning() {
  return (
    <div
      className={[styles.alert, styles.alertWarning].join(" ")}
      role="note"
      aria-label="Public repositories expose customer mail"
    >
      <div className={styles.platformAdminBanner}>
        <AlertTriangle {...iconMd} aria-hidden />
        <div>
          <p className={styles.platformAdminBannerTitle}>
            Do not use a public repository or project
          </p>
          <p className={styles.platformAdminBannerText}>
            Support mail is confidential. Customer email addresses and message
            bodies are copied into issues and comments. Anyone who can view a
            public GitHub repository or GitLab project can read that content —
            use a <strong>private</strong> repository or project instead.{" "}
            <DocsLink to={`${DOC_PATHS.issueProviders}#public-repo-warning`}>
              Learn more
            </DocsLink>
          </p>
        </div>
      </div>
    </div>
  );
}
