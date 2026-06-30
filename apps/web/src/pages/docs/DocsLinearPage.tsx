import { DocsLayout } from "../../components/DocsLayout";

const LINEAR_API_DOCS = "https://linear.app/developers/graphql";

export function DocsLinearPage() {
  return (
    <DocsLayout
      title="Linear API key"
      lead="Personal API key for Linear workspaces on linear.app."
    >
      <p>
        ServiceBeard uses the API key to create issues from inbound mail, post and read issue
        comments, upload attachments, list labels, members, and workflow states for routing rules,
        and register a team webhook for <strong>Comment</strong> events so replies sync back to
        email.
      </p>
      <p>
        In the project settings, set <strong>Team or project</strong> to a team UUID, team key
        (for example <code>ENG</code>), or project slug. You can also paste a Linear URL in the
        wizard — ServiceBeard supports both team and project links.
      </p>

      <h2>Team or project URL</h2>
      <p>Examples of URLs you can paste when creating a project:</p>
      <ul>
        <li>
          <strong>Team</strong> —{" "}
          <code>https://linear.app/acme/team/ENG/active</code> (issues are created on that team)
        </li>
        <li>
          <strong>Project</strong> —{" "}
          <code>https://linear.app/acme/project/my-project/overview</code> (issues are created on
          the project&apos;s team and assigned to that project)
        </li>
      </ul>
      <p>
        Team links are usually the simplest choice. Use a project link when you want inbound mail to
        file issues into a specific Linear project.
      </p>

      <h2>Required permissions</h2>
      <p>
        Choose <strong>Only select permissions…</strong> and enable the minimum scopes ServiceBeard
        needs:
      </p>
      <ul>
        <li>
          <strong>Read</strong> — list labels, members, and workflow states for routing rules; read
          issue comments for sync
        </li>
        <li>
          <strong>Create issues</strong> — create issues from inbound mail
        </li>
        <li>
          <strong>Create comments</strong> — post customer replies as issue comments and process
          outbound sync
        </li>
        <li>
          <strong>Admin</strong> — register the team webhook for comment events (required for
          real-time reply sync)
        </li>
      </ul>
      <p>
        Under <strong>Team access</strong>, choose <strong>Only select teams…</strong> and include
        every Linear team (or project&apos;s team) you link in ServiceBeard. Granting access to all
        teams you use is fine if you prefer not to maintain a narrow list.
      </p>
      <p>
        <strong>Write</strong> and <strong>Full access</strong> are not required when the scopes
        above are selected.
      </p>

      <h2>Create a personal API key</h2>
      <ol>
        <li>
          In Linear, open <strong>Settings</strong> → <strong>Account</strong> →{" "}
          <strong>Security &amp; access</strong> → <strong>Personal API keys</strong>.
        </li>
        <li>
          Create a key named <code>ServiceBeard</code> (or similar). Set permissions and team access
          as described above.
        </li>
        <li>
          Copy the key immediately and paste it into ServiceBeard&apos;s <strong>API key</strong>{" "}
          field when linking the project.
        </li>
      </ol>
      <p>
        If webhook registration fails during project creation, confirm <strong>Admin</strong> is
        enabled on the key and that your Linear account can manage webhooks for the linked team. A
        workspace admin may need to create the webhook manually.
      </p>
      <p>
        See Linear&apos;s API documentation:{" "}
        <a href={LINEAR_API_DOCS} target="_blank" rel="noopener noreferrer">
          GraphQL API
        </a>
        .
      </p>

      <h2>Internal team comments</h2>
      <p>
        Linear has no built-in internal notes. To comment on an issue without emailing the customer,
        put <code>[internal]</code> at the start or end of your comment, for example{" "}
        <code>[internal] Waiting on infra team</code>. ServiceBeard skips those comments for
        outbound email.
      </p>
      <p>
        Linear issue descriptions use Markdown only (not HTML). ServiceBeard formats the support
        details footer and sync markers accordingly.
      </p>
    </DocsLayout>
  );
}
