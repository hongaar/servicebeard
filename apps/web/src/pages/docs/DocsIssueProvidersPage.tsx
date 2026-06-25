import { Link } from "@tanstack/react-router";
import { DocsLayout } from "../../components/DocsLayout";
import { DOC_PATHS } from "../../lib/docs";
import styles from "../../styles/docs.module.css";

export function DocsIssueProvidersPage() {
  return (
    <DocsLayout
      title="Issue providers"
      lead="ServiceBeard creates issues from inbound mail and keeps comments in sync with your tracker."
    >
      <p>
        Each project points at one repository or GitLab project. Authentication is a personal access
        token (GitLab) or a GitHub App installation / personal access token (GitHub). The token or
        app needs permission to create issues, post comments, list labels and members, and register
        a webhook for comment events.
      </p>

      <div className={styles.cardGrid}>
        <Link to={DOC_PATHS.github} className={styles.card}>
          <h2 className={styles.cardTitle}>GitHub</h2>
          <p className={styles.cardDesc}>
            GitHub App installation or personal access tokens for GitHub Cloud and Enterprise
            Server.
          </p>
        </Link>
        <Link to={DOC_PATHS.gitlab} className={styles.card}>
          <h2 className={styles.cardTitle}>GitLab</h2>
          <p className={styles.cardDesc}>
            Project access tokens (recommended) or personal access tokens for GitLab.com,
            Dedicated, and self-hosted.
          </p>
        </Link>
      </div>

      <h2>Internal team comments</h2>
      <p>
        Comments on synced issues are emailed to the customer by default. To discuss an issue with
        your team without notifying the customer, add <code>[internal]</code> at the{" "}
        <strong>start</strong> or <strong>end</strong> of the comment (case-insensitive).
      </p>
      <p>Examples:</p>
      <ul>
        <li>
          <code>[internal] Checking with billing — will update tomorrow.</code>
        </li>
        <li>
          <code>Need a second look at the logs [internal]</code>
        </li>
      </ul>
      <p>
        This works on GitHub and GitLab. On GitLab you can also use native internal notes; both are
        skipped for outbound email.
      </p>
      <p>
        New issues created from mail include a collapsible <strong>Support details</strong> section
        at the bottom with a link to the ServiceBeard project and this hint.
      </p>
    </DocsLayout>
  );
}
