import { DocsLayout } from "../../components/DocsLayout";
import { DocsWarning } from "../../components/DocsWarning";
import styles from "../../styles/docs.module.css";

const GITLAB_PROJECT_TOKEN_DOCS =
  "https://docs.gitlab.com/user/project/settings/project_access_tokens/";
const GITLAB_FINE_GRAINED_PAT_DOCS =
  "https://docs.gitlab.com/auth/tokens/fine_grained_access_tokens/";

export function DocsGitLabPage() {
  return (
    <DocsLayout
      title="GitLab access token"
      lead="Access token for GitLab.com, GitLab Dedicated, or a self-hosted GitLab instance."
    >
      <p>
        ServiceBeard uses the token to create issues from inbound mail, post and
        read issue notes (comments), upload attachments, list labels and members
        for routing rules, read custom issue statuses (where available), and
        register a project webhook for <strong>Note events</strong> so replies
        sync back to email.
      </p>
      <p>
        In the project settings, set <strong>Project</strong> to a numeric
        project ID or path like <code>group/project</code> (for example{" "}
        <code>acme/website</code>). You can also paste a GitLab project URL in
        the wizard — ServiceBeard extracts the path automatically.
      </p>

      <DocsWarning title="Use a private project for support mail">
        <p>
          Customer mail is confidential. Inbound messages become GitLab issues
          and notes that include the sender&apos;s address and message body. If
          the project visibility is <strong>Public</strong>, that content is
          visible to anyone who can browse the project — not only your team.
        </p>
        <p>
          Set the GitLab project to <strong>Private</strong> (or{" "}
          <strong>Internal</strong> on self-managed instances) before connecting
          a support mailbox in ServiceBeard.
        </p>
      </DocsWarning>

      <h2>Recommended: project access token</h2>
      <p>
        A <strong>project access token</strong> is usually the simplest option.
        GitLab creates a dedicated bot user automatically when you create the
        token — you do not need a separate service account or to invite a bot
        user to the project manually. The bot is scoped to that project only and
        does not count toward your license limit.
      </p>
      <p>
        See GitLab&apos;s guide:{" "}
        <a
          href={GITLAB_PROJECT_TOKEN_DOCS}
          target="_blank"
          rel="noopener noreferrer"
        >
          Project access tokens
        </a>
        .
      </p>

      <h3>Prerequisites</h3>
      <ul>
        <li>
          You need the <strong>Maintainer</strong> or <strong>Owner</strong>{" "}
          role on the GitLab project to create a project access token.
        </li>
        <li>
          On <strong>GitLab.com</strong>, project access tokens require a
          Premium or Ultimate subscription. On Free, use a fine-grained or
          classic personal access token from a bot account instead (see below).
        </li>
        <li>
          On <strong>GitLab Self-Managed</strong> and{" "}
          <strong>GitLab Dedicated</strong>, project access tokens are available
          on all license tiers.
        </li>
      </ul>

      <h3>Create a project access token</h3>
      <ol>
        <li>
          In GitLab, open the target project → <strong>Settings</strong> →{" "}
          <strong>Access tokens</strong>.
        </li>
        <li>
          Select <strong>Create project access token</strong>. Enter a name (for
          example <code>ServiceBeard</code>) and an expiration date.
        </li>
        <li>
          Set <strong>Role</strong> to at least <strong>Developer</strong> (use{" "}
          <strong>Maintainer</strong> if webhook registration fails later).
        </li>
        <li>
          Select the <code>api</code> scope. This grants the read/write API
          access ServiceBeard needs for issues, notes, uploads, members, and
          webhooks.
        </li>
        <li>
          Create the token, copy it immediately, and paste it into
          ServiceBeard&apos;s <strong>Access token</strong> field. GitLab shows
          the token only once.
        </li>
      </ol>
      <p>
        GitLab creates a bot user named after the token (for example{" "}
        <code>project_123_bot_…</code>). ServiceBeard authenticates as this bot
        — human comments on issues still sync to email because they come from a
        different user.
      </p>

      <h3>What the api scope covers</h3>
      <table className={styles.permissionTable}>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Why ServiceBeard needs it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Create and update issues</td>
            <td>
              Convert inbound email into GitLab issues; apply labels, assignees,
              and status
            </td>
          </tr>
          <tr>
            <td>Issue notes</td>
            <td>Post comment replies and read customer-facing discussion</td>
          </tr>
          <tr>
            <td>Project uploads</td>
            <td>Attach images from email to issue descriptions and notes</td>
          </tr>
          <tr>
            <td>Labels and members</td>
            <td>Populate routing rule dropdowns in the project settings</td>
          </tr>
          <tr>
            <td>Project hooks</td>
            <td>
              Register the <strong>Note events</strong> webhook for real-time
              comment sync
            </td>
          </tr>
          <tr>
            <td>GraphQL (statuses)</td>
            <td>
              Load custom issue statuses on GitLab Premium/Ultimate where
              configured
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        <code>read_api</code> alone is not sufficient — ServiceBeard must write
        issues, notes, and webhooks.
      </p>

      <h2>Alternative: personal access token</h2>
      <p>
        Use a personal access token when project access tokens are unavailable —
        for example on GitLab.com Free, or when you cannot get Maintainer access
        on the project.
      </p>
      <p>
        <strong>Important:</strong> do not use your own personal login. Create a
        dedicated bot account (for example <code>servicebeard-bot</code>), add
        it to the project with at least <strong>Developer</strong> role (
        <strong>Maintainer</strong> for webhooks), then generate a token for
        that account. ServiceBeard skips notes authored by the authenticated
        user when syncing outbound, so using your personal account can hide your
        own comments from email sync.
      </p>

      <h3>Fine-grained personal access token</h3>
      <p>
        Fine-grained tokens let you limit a PAT to one project and specific API
        permissions instead of the broad classic <code>api</code> scope. They
        are available on GitLab.com Free (unlike project access tokens) and are
        a good choice when you want least-privilege access from a bot account.
      </p>
      <p>
        Fine-grained PAT support is still <strong>beta</strong>. See
        GitLab&apos;s guide:{" "}
        <a
          href={GITLAB_FINE_GRAINED_PAT_DOCS}
          target="_blank"
          rel="noopener noreferrer"
        >
          Fine-grained personal access tokens
        </a>
        .
      </p>
      <ol>
        <li>
          Sign in as the bot account, then open{" "}
          <a
            href="https://gitlab.com/-/user_settings/personal_access_tokens"
            target="_blank"
            rel="noopener noreferrer"
          >
            User Settings → Access tokens
          </a>{" "}
          (on self-hosted: <strong>Preferences → Access tokens</strong>).
        </li>
        <li>
          Create a <strong>fine-grained</strong> token named{" "}
          <code>ServiceBeard</code> with an expiration date.
        </li>
        <li>
          Under <strong>Group and project access</strong>, choose{" "}
          <em>Only select groups and projects</em> and pick the project you
          configured in ServiceBeard.
        </li>
        <li>
          In the permissions panel, enable the resources below for that project.
        </li>
        <li>
          Copy the token into ServiceBeard&apos;s <strong>Access token</strong>{" "}
          field.
        </li>
      </ol>

      <table className={styles.permissionTable}>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Permissions</th>
            <th>Why ServiceBeard needs it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>User</td>
            <td>Read</td>
            <td>
              <code>GET /user</code> — verify the connection and show the
              authenticated username
            </td>
          </tr>
          <tr>
            <td>Project</td>
            <td>Read</td>
            <td>Load project metadata</td>
          </tr>
          <tr>
            <td>Work Item</td>
            <td>Create, Read, Update</td>
            <td>
              Create issues from mail, read and post issue notes, update status,
              add reactions
            </td>
          </tr>
          <tr>
            <td>Label</td>
            <td>Read</td>
            <td>List labels for routing rules</td>
          </tr>
          <tr>
            <td>Member</td>
            <td>Read</td>
            <td>List project members for assignee options</td>
          </tr>
          <tr>
            <td>Webhook</td>
            <td>Create, Read, Update</td>
            <td>
              Register and update the <strong>Note events</strong> project hook
            </td>
          </tr>
          <tr>
            <td>Markdown Upload</td>
            <td>Create, Read</td>
            <td>Attach images from email to issues and notes</td>
          </tr>
        </tbody>
      </table>

      <p>
        Custom issue statuses (GitLab Premium/Ultimate) are loaded via GraphQL.
        If the status dropdown in routing rules only shows Open and Closed,
        either use a classic <code>api</code> scope token or check GitLab&apos;s
        current GraphQL support for fine-grained tokens.
      </p>

      <h3>Classic personal access token</h3>
      <p>
        Classic tokens use a single <code>api</code> scope that covers all REST
        API access for repositories the bot account can reach. This is simpler
        to set up but grants broader access than a fine-grained token.
      </p>
      <ol>
        <li>
          Sign in as the bot account and open{" "}
          <a
            href="https://gitlab.com/-/user_settings/personal_access_tokens"
            target="_blank"
            rel="noopener noreferrer"
          >
            User Settings → Access tokens
          </a>
          .
        </li>
        <li>
          Create a <strong>classic</strong> token named{" "}
          <code>ServiceBeard</code> with the <code>api</code> scope and paste it
          into ServiceBeard.
        </li>
      </ol>

      <h3>What the api scope covers</h3>
      <p>
        The <code>api</code> scope (used by classic PATs and project access
        tokens) includes everything in the fine-grained table above, plus
        GraphQL access for custom issue statuses.
      </p>

      <h2>Hosting options</h2>
      <ul>
        <li>
          <strong>Cloud:</strong> leave the instance URL at{" "}
          <code>https://gitlab.com</code>.
        </li>
        <li>
          <strong>Self-hosted:</strong> set <strong>Instance URL</strong> to the
          site root (for example <code>https://gitlab.mycompany.com</code>) —
          not the API path.
        </li>
        <li>
          <strong>GitLab Dedicated:</strong> choose Dedicated in hosting and
          enter your dedicated instance URL.
        </li>
      </ul>

      <h2>Self-hosted TLS</h2>
      <p>
        If your GitLab instance uses a certificate signed by a private CA, paste
        the CA certificate (PEM) in <strong>Custom CA certificate</strong> on
        the project. Only enable{" "}
        <strong>Skip TLS certificate verification</strong> when you cannot
        provide a CA — it disables certificate checks for API calls from
        ServiceBeard to GitLab.
      </p>
      <p>
        You can also set <code>TLS_CA_BUNDLE</code> in the ServiceBeard API and
        worker environment to trust a CA bundle for all provider connections.
      </p>

      <h2>Webhooks</h2>
      <p>
        When a project is created, ServiceBeard tries to register a project hook
        with <strong>Note events</strong> and{" "}
        <strong>Confidential note events</strong> enabled. Your ServiceBeard
        deployment must expose a public API URL via{" "}
        <code>WEBHOOK_BASE_URL</code> so GitLab can deliver events.
      </p>
      <p>
        If registration fails — for example because the API is only reachable on
        localhost — the error appears in project sync errors and comment polling
        still syncs replies, just more slowly.
      </p>

      <h2>Verify the connection</h2>
      <p>
        Use <strong>Test provider connection</strong> in the project wizard or
        settings. A successful test confirms API access and shows the
        authenticated GitLab username (the project bot user for project access
        tokens).
      </p>

      <h2>Troubleshooting</h2>
      <ul>
        <li>
          <strong>404 on project:</strong> verify the numeric ID or{" "}
          <code>group/project</code> path. URL-encoded paths work; special
          characters must match GitLab&apos;s project path exactly.
        </li>
        <li>
          <strong>403 Forbidden:</strong> the token may need a higher role — try{" "}
          <strong>Maintainer</strong> on the project access token, or ensure a
          PAT bot user is a project member with sufficient access.
        </li>
        <li>
          <strong>401 Unauthorized:</strong> token expired or revoked — create a
          new token and update the project.
        </li>
        <li>
          <strong>Cannot create project access token:</strong> on GitLab.com
          Free, use a fine-grained or classic personal access token from a
          dedicated bot account. On self-managed, check that project access
          tokens are not restricted by group settings.
        </li>
        <li>
          <strong>403 with fine-grained token:</strong> confirm the token is
          scoped to the correct project and includes Create/Read/Update on{" "}
          <strong>Work Item</strong> plus Create/Read/Update on{" "}
          <strong>Webhook</strong>.
        </li>
        <li>
          <strong>Comments not syncing to email:</strong> confirm the webhook
          exists under <strong>Project → Settings → Webhooks</strong> with Note
          events, and that <code>WEBHOOK_BASE_URL</code> is reachable from
          GitLab.
        </li>
        <li>
          <strong>TLS errors on self-hosted:</strong> add the signing CA in PEM
          format or set <code>TLS_CA_BUNDLE</code> on the server.
        </li>
        <li>
          <strong>Instance URL wrong:</strong> use the web UI root URL, not{" "}
          <code>/api/v4</code>. ServiceBeard appends the API path automatically.
        </li>
      </ul>
    </DocsLayout>
  );
}
