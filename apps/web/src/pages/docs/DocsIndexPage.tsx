import { Link } from "@tanstack/react-router";
import { DocsLayout } from "../../components/DocsLayout";
import { DOC_PATHS } from "../../lib/docs";
import styles from "../../styles/docs.module.css";

export function DocsIndexPage() {
  return (
    <DocsLayout
      title="Documentation"
      lead="Setup guides for connecting a support mailbox and issue tracker to ServiceBeard."
    >
      <div className={styles.cardGrid}>
        <Link to={DOC_PATHS.selfHost} className={styles.card}>
          <h2 className={styles.cardTitle}>Self-hosting</h2>
          <p className={styles.cardDesc}>
            Kubernetes Helm chart for production deployments. Docker Compose for self-host coming
            soon.
          </p>
        </Link>
        <Link to={DOC_PATHS.mailbox} className={styles.card}>
          <h2 className={styles.cardTitle}>Mailbox configuration</h2>
          <p className={styles.cardDesc}>
            IMAP and SMTP settings for the inbox that receives customer email.
          </p>
        </Link>
        <Link to={DOC_PATHS.issueProviders} className={styles.card}>
          <h2 className={styles.cardTitle}>Issue providers</h2>
          <p className={styles.cardDesc}>
            GitHub App, access tokens, and repository settings for GitHub and GitLab.
          </p>
        </Link>
      </div>
    </DocsLayout>
  );
}
