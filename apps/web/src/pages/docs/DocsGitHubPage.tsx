import { DocsLayout } from "../../components/DocsLayout";

export function DocsGitHubPage() {
  return (
    <DocsLayout
      title="GitHub authentication"
      lead="Connect ServiceBeard to GitHub Cloud or GitHub Enterprise Server."
    >
      <p>
        ServiceBeard uses GitHub credentials to create issues from inbound mail, post and read issue
        comments, attach images to comments, list labels and collaborators for routing rules, and
        register an <code>issue_comment</code> webhook so replies sync back to email.
      </p>
      <p>
        In the project settings, set <strong>Repository</strong> to <code>owner/repo</code> (for
        example <code>acme/support</code>). You can also paste a GitHub repository URL in the wizard
        — ServiceBeard extracts <code>owner/repo</code> automatically. For GitHub Enterprise
        Server, also set the instance root URL — not the API endpoint.
      </p>

      <h2>Which authentication method?</h2>
      <p>
        When <code>GITHUB_APP_ID</code> is configured on the ServiceBeard server, projects use a
        GitHub App only — install it from the project wizard with one click. Otherwise, each project
        needs a personal access token from a dedicated bot account.
      </p>
      <ul>
        <li>
          <strong>GitHub App (when enabled on server):</strong> ServiceBeard acts as{" "}
          <code>your-app[bot]</code>. Click <strong>Install GitHub App</strong> in the project wizard;
          no manual installation ID is required.
        </li>
        <li>
          <strong>Personal access token (when no GitHub App on server):</strong> Create a dedicated{" "}
          <em>machine user</em> (bot account), grant it access to the repository, and generate a PAT
          for that account.
        </li>
      </ul>

      <h2>GitHub App setup (server admin)</h2>
      <p>
        Configure once on the ServiceBeard API and worker. When <code>GITHUB_APP_ID</code> is set,
        the project UI hides PAT fields and offers in-app installation instead.
      </p>

      <h3>1. Create the GitHub App</h3>
      <ol>
        <li>
          Open{" "}
          <a
            href="https://github.com/settings/apps/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
          </a>{" "}
          (or your organization&apos;s <strong>Settings → Developer settings → GitHub Apps</strong>).
        </li>
        <li>
          Set a name (for example <code>ServiceBeard</code>) and homepage. Set the{" "}
          <strong>Setup URL</strong> to your ServiceBeard API callback, for example{" "}
          <code>http://localhost:3000/api/github-app/setup</code> in development or{" "}
          <code>https://your-domain.com/api/github-app/setup</code> in production. The generic
          webhook URL can be left blank — ServiceBeard registers per-repository{" "}
          <code>issue_comment</code> hooks via the API.
        </li>
        <li>
          Under <strong>Repository permissions</strong>, set:
          <ul>
            <li>
              <strong>Issues</strong> — Read and write (create issues, comments, reactions,
              attachments)
            </li>
            <li>
              <strong>Webhooks</strong> — Read and write (register the comment webhook)
            </li>
            <li>
              <strong>Administration</strong> — Read-only (list collaborators for routing rules)
            </li>
            <li>
              <strong>Metadata</strong> — Read (required baseline access)
            </li>
          </ul>
        </li>
        <li>
          Under <strong>Subscribe to events</strong>, you do not need app-level events for normal
          operation; repository webhooks are created automatically.
        </li>
        <li>
          Choose <strong>Only on this account</strong> or allow any account, then create the app.
        </li>
        <li>
          Generate a <strong>private key</strong> and note the <strong>App ID</strong> on the app
          settings page.
        </li>
      </ol>

      <h3>2. Configure ServiceBeard</h3>
      <p>Add to your API and worker environment (see README):</p>
      <ul>
        <li>
          <code>GITHUB_APP_ID</code> — numeric App ID
        </li>
        <li>
          <code>GITHUB_APP_PRIVATE_KEY</code> — PEM contents (use <code>\n</code> for newlines in
          <code>.env</code>), or <code>GITHUB_APP_PRIVATE_KEY_PATH</code> pointing at the{" "}
          <code>.pem</code> file
        </li>
      </ul>

      <h3>3. Connect from the project wizard</h3>
      <ol>
        <li>Create or edit a GitHub project in ServiceBeard and set <code>owner/repo</code>.</li>
        <li>
          Click <strong>Install GitHub App</strong>. GitHub opens so you can choose the org or user
          and grant access to the repository.
        </li>
        <li>
          After installation, you return to ServiceBeard with the connection ready. Run{" "}
          <strong>Test connection</strong> to confirm (for example <code>servicebeard[bot]</code>).
        </li>
      </ol>

      <h2>Personal access token (when GitHub App is not enabled)</h2>
      <p>
        If <code>GITHUB_APP_ID</code> is not set on the server, each project needs a PAT from a
        separate GitHub user (for example <code>servicebeard-bot</code>) that exists only for
        automation — not your personal login.
      </p>

      <h3>Classic personal access token</h3>
      <p>
        Classic tokens use OAuth-style <em>scopes</em> that apply across all repositories the bot
        account can access.
      </p>
      <ol>
        <li>
          Sign in as the bot account, then open{" "}
          <a
            href="https://github.com/settings/tokens/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Settings → Developer settings → Personal access tokens → Tokens (classic)
          </a>
          .
        </li>
        <li>Choose a note and expiration.</li>
        <li>
          Select scopes:
          <ul>
            <li>
              <strong>Private repositories:</strong> enable <code>repo</code> (full control of
              private repositories). This covers issues, comments, webhooks, and collaborators.
            </li>
            <li>
              <strong>Public repositories only:</strong> <code>public_repo</code> is enough.
            </li>
          </ul>
        </li>
        <li>Generate the token and paste it into the project&apos;s <strong>Access token</strong> field.</li>
      </ol>

      <h3>Fine-grained personal access token</h3>
      <p>
        Fine-grained tokens are limited to specific repositories and use explicit repository
        permissions instead of broad scopes.
      </p>
      <ol>
        <li>
          Sign in as the bot account, then open{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Settings → Developer settings → Personal access tokens → Fine-grained tokens
          </a>
          .
        </li>
        <li>
          Set <strong>Resource owner</strong> to the organization that owns the repository.
        </li>
        <li>
          Under <strong>Repository access</strong>, choose <em>Only select repositories</em> and pick
          the repository you configured in ServiceBeard.
        </li>
        <li>
          Set <strong>Repository permissions</strong> as follows:
        </li>
      </ol>

      <table className="permissionTable">
        <thead>
          <tr>
            <th>Permission</th>
            <th>Access level</th>
            <th>Why ServiceBeard needs it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Issues</td>
            <td>Read and write</td>
            <td>
              Create issues from mail, post and read comments, upload comment attachments, add
              reactions
            </td>
          </tr>
          <tr>
            <td>Webhooks</td>
            <td>Read and write</td>
            <td>Register and update the <code>issue_comment</code> webhook</td>
          </tr>
          <tr>
            <td>Administration</td>
            <td>Read-only</td>
            <td>List repository collaborators for assignee options in routing rules</td>
          </tr>
          <tr>
            <td>Metadata</td>
            <td>Read</td>
            <td>Included automatically when other permissions are selected; required for basic API
            access</td>
          </tr>
        </tbody>
      </table>

      <p>
        You do <strong>not</strong> need Contents, Pull requests, or other permissions for normal
        ServiceBeard operation.
      </p>
      <p>Generate the token and paste it into the project&apos;s <strong>Access token</strong> field.</p>

      <h2>Verify the connection</h2>
      <p>
        Use <strong>Test connection</strong> in the project wizard or settings. A successful test
        confirms API access and shows the authenticated GitHub user or app bot.
      </p>

      <h2>Internal team comments</h2>
      <p>
        GitHub has no built-in internal notes. To comment on an issue without emailing the customer,
        put <code>[internal]</code> at the start or end of your comment, for example{" "}
        <code>[internal] Waiting on infra team</code>. ServiceBeard skips those comments for
        outbound mail.
      </p>

      <h2>Troubleshooting</h2>
      <ul>
        <li>
          <strong>GitHub App not configured:</strong> ensure <code>GITHUB_APP_ID</code> and private
          key env vars are set on the API and worker processes, then restart.
        </li>
        <li>
          <strong>404 on repository:</strong> check the <code>owner/repo</code> slug and that the app
          installation or token&apos;s repository access includes that repo.
        </li>
        <li>
          <strong>403 on collaborators or webhooks:</strong> add Administration read (for
          collaborators) or Webhooks read and write (for comment sync).
        </li>
        <li>
          <strong>Comments not syncing outbound:</strong> if you use a PAT on your personal account,
          ServiceBeard may treat your own comments as bot-authored. Use a GitHub App or a dedicated
          bot account PAT instead.
        </li>
        <li>
          <strong>Enterprise Server:</strong> create the app or token on your instance and set the
          instance URL in project settings to the site root (for example{" "}
          <code>https://github.mycompany.com</code>).
        </li>
      </ul>
    </DocsLayout>
  );
}
