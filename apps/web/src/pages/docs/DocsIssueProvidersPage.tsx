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
        Each project points at one GitHub repository, GitLab project, or Linear
        team (or Linear project). Authentication is a personal access token
        (GitLab), a GitHub App installation / personal access token (GitHub), or
        a personal API key (Linear). The token or app needs permission to create
        issues, post comments, list labels and members, and register a webhook
        for comment events.
      </p>

      <h2>Paste a link in the wizard</h2>
      <p>
        When creating a project, you can paste a tracker URL and ServiceBeard
        detects the provider automatically:
      </p>
      <ul>
        <li>
          <strong>GitHub</strong> — repository URL (for example{" "}
          <code>https://github.com/acme/support</code>)
        </li>
        <li>
          <strong>GitLab</strong> — project URL (for example{" "}
          <code>https://gitlab.com/acme/website</code>)
        </li>
        <li>
          <strong>Linear</strong> — team URL (for example{" "}
          <code>https://linear.app/acme/team/ENG/active</code>) or project URL
          (for example{" "}
          <code>https://linear.app/acme/project/my-project/overview</code>)
        </li>
      </ul>

      <div className={styles.cardGrid}>
        <Link to={DOC_PATHS.github} className={styles.card}>
          <h2 className={styles.cardTitle}>GitHub</h2>
          <p className={styles.cardDesc}>
            GitHub App installation or personal access tokens for GitHub Cloud
            and Enterprise Server.
          </p>
        </Link>
        <Link to={DOC_PATHS.gitlab} className={styles.card}>
          <h2 className={styles.cardTitle}>GitLab</h2>
          <p className={styles.cardDesc}>
            Project access tokens (recommended) or personal access tokens for
            GitLab.com, Dedicated, and self-hosted.
          </p>
        </Link>
        <Link to={DOC_PATHS.linear} className={styles.card}>
          <h2 className={styles.cardTitle}>Linear</h2>
          <p className={styles.cardDesc}>
            Personal API keys for Linear workspaces — link a team or project on
            linear.app.
          </p>
        </Link>
      </div>

      <h2>Internal team comments</h2>
      <p>
        Comments on synced issues are emailed to the customer by default. To
        discuss an issue with your team without notifying the customer, add{" "}
        <code>[internal]</code> at the <strong>start</strong> or{" "}
        <strong>end</strong> of the comment (case-insensitive).
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
        This works on GitHub, GitLab, and Linear. On GitLab you can also use
        native internal notes; both are skipped for outbound email.
      </p>
      <p>
        New issues created from mail include a collapsible{" "}
        <strong>Support details</strong> section at the bottom with a link to
        the ServiceBeard project and this hint.
      </p>
    </DocsLayout>
  );
}
