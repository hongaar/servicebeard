import { Link } from "@tanstack/react-router";
import { DocsLayout } from "../../components/DocsLayout";
import { DOC_PATHS } from "../../lib/docs";
import styles from "../../styles/docs.module.css";

export function DocsSelfHostPage() {
  return (
    <DocsLayout
      title="Self-hosting"
      lead="Run ServiceBeard on your own infrastructure with Kubernetes. The same codebase powers the managed cloud."
    >
      <p>
        ServiceBeard is open source under the MIT license. For production self-hosting, deploy with
        the Helm chart and published container images. If you prefer not to operate the stack
        yourself, use the managed cloud instead.
      </p>
      <p>
        For local development, see the{" "}
        <a href="https://github.com/hongaar/servicebeard" rel="noopener noreferrer">
          repository README
        </a>
        — the existing Docker Compose stack is for dev workflows only (Postgres, GreenMail, hot
        reload), not production deployments.
      </p>

      <h2>Production on Kubernetes</h2>
      <p>
        Container images and a Helm chart are published to{" "}
        <a
          href="https://github.com/hongaar?tab=packages&repo_name=servicebeard"
          rel="noopener noreferrer"
        >
          GitHub Container Registry
        </a>
        . Install with a public hostname and generated secrets:
      </p>
      <pre>
        <code>{`helm install servicebeard oci://ghcr.io/hongaar/servicebeard-helm \\
  --version 0.1.0 \\
  --set ingress.host=your-domain.com \\
  --set secrets.encryptionKey=<64-char-hex> \\
  --set secrets.oidcClientSecret=<secret> \\
  --set secrets.sessionSecret=<secret>`}</code>
      </pre>
      <p>
        Pin a release with <code>--set image.tag=&lt;git-sha&gt;</code>. You can also build images
        locally and install from the chart in the repository&apos;s <code>deploy/helm</code>{" "}
        directory.
      </p>

      <h2>Docker Compose</h2>
      <p>
        A production-oriented Docker Compose deployment is planned but not available yet. The
        Compose file in the repository today is dev-only and will be rewritten for self-hosted
        production installs (without Kubernetes). Check back here once that stack ships.
      </p>

      <h2>What you operate</h2>
      <ul>
        <li>
          <strong>API</strong> — REST API, webhooks, and session handling
        </li>
        <li>
          <strong>Worker</strong> — IMAP polling, SMTP outbound, and issue sync jobs
        </li>
        <li>
          <strong>Web</strong> — React frontend (same UI as cloud)
        </li>
        <li>
          <strong>Postgres</strong> — application database (included in the Helm chart)
        </li>
      </ul>
      <p>
        Mail credentials and issue-tracker tokens are stored encrypted in your database. You control
        backups, upgrades, and network access.
      </p>

      <h2>Managed cloud</h2>
      <p>
        If you do not want to run Kubernetes or maintain Postgres yourself, use the hosted cloud at{" "}
        <Link to="/">servicebeard.app</Link>. Setup guides for{" "}
        <Link to={DOC_PATHS.mailbox}>mailbox configuration</Link> and{" "}
        <Link to={DOC_PATHS.issueProviders}>issue providers</Link> apply to both self-hosted and
        cloud deployments.
      </p>

      <div className={styles.cardGrid}>
        <a
          href="https://github.com/hongaar/servicebeard"
          className={styles.card}
          rel="noopener noreferrer"
        >
          <h2 className={styles.cardTitle}>Source &amp; README</h2>
          <p className={styles.cardDesc}>
            Local development setup, environment variables, and architecture notes on GitHub.
          </p>
        </a>
        <a
          href="https://github.com/hongaar?tab=packages&repo_name=servicebeard"
          className={styles.card}
          rel="noopener noreferrer"
        >
          <h2 className={styles.cardTitle}>Container images</h2>
          <p className={styles.cardDesc}>
            Pre-built API, worker, and web images on GHCR for Kubernetes deployments.
          </p>
        </a>
      </div>
    </DocsLayout>
  );
}
