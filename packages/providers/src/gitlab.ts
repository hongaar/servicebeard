import { providerFetch } from "./http";
import type {
    AddCommentResult,
    CreateIssueInput,
    CreateIssueResult,
    IssueProvider,
    NormalizedWebhookEvent,
    ProviderConfig,
    ProviderNote,
    ProviderOptions,
    UploadFileResult,
} from "./types";

interface GitLabUser {
  id: number;
  username: string;
}

interface GitLabIssue {
  id: number;
  iid: number;
  web_url: string;
}

interface GitLabNote {
  id: number;
  body: string;
  author: { id: number; username: string };
  confidential?: boolean;
  internal?: boolean;
  created_at: string;
}

interface GitLabLabel {
  name: string;
  color: string;
}

interface GitLabMember {
  id: number;
  name: string;
  username: string;
}

interface GitLabIssueStatus {
  id: string;
  name: string;
  color?: string | null;
}

interface GitLabProject {
  path_with_namespace: string;
  namespace?: {
    full_path: string;
  };
}

interface GitLabWebhookPayload {
  object_kind?: string;
  object_attributes?: {
    id?: number;
    note?: string;
    noteable_type?: string;
    confidential?: boolean;
    internal?: boolean;
    created_at?: string;
    url?: string;
  };
  user?: { id: number; username: string };
  project?: { id: number };
  issue?: { id: number; iid: number };
}

export class GitLabProvider implements IssueProvider {
  readonly name = "gitlab";

  constructor(private config: ProviderConfig) {}

  private get apiBase(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/api/v4`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.apiBase}${path}`;
    const response = await providerFetch(this.config, url, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private encodeProjectId(): string {
    return encodeURIComponent(this.config.projectId);
  }

  async getCurrentUser(): Promise<{ id: string; username: string }> {
    const user = await this.request<GitLabUser>("GET", "/user");
    return { id: String(user.id), username: user.username };
  }

  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    const issue = await this.request<GitLabIssue>(
      "POST",
      `/projects/${this.encodeProjectId()}/issues`,
      {
        title: input.title,
        description: input.description,
        labels: input.labels?.join(","),
        assignee_ids: input.assigneeId ? [Number(input.assigneeId)] : undefined,
      },
    );

    if (input.status && input.status !== "opened") {
      await this.applyIssueStatus(issue.iid, input.status);
    }

    return {
      externalId: String(issue.id),
      iid: issue.iid,
      url: issue.web_url,
    };
  }

  private async applyIssueStatus(issueIid: number, status: string): Promise<void> {
    if (status === "opened") return;

    if (status === "closed") {
      await this.request(
        "PUT",
        `/projects/${this.encodeProjectId()}/issues/${issueIid}`,
        { state_event: "close" },
      );
      return;
    }

    if (status.startsWith("gid://")) {
      await this.updateWorkItemStatus(issueIid, status);
      return;
    }

    await this.request(
      "PUT",
      `/projects/${this.encodeProjectId()}/issues/${issueIid}`,
      { status },
    );
  }

  async listProjectOptions(): Promise<ProviderOptions> {
    const projectId = this.encodeProjectId();
    const project = await this.getProjectMeta();

    const [labels, members, statuses] = await Promise.all([
      this.request<GitLabLabel[]>(
        "GET",
        `/projects/${projectId}/labels?per_page=100`,
      ),
      this.request<GitLabMember[]>(
        "GET",
        `/projects/${projectId}/members/all?per_page=100`,
      ),
      this.listIssueStatuses(project),
    ]);

    return {
      labels: labels.map((l) => ({ name: l.name, color: l.color ?? null })),
      members: members.map((m) => ({
        id: String(m.id),
        name: m.name,
        username: m.username,
      })),
      statuses,
    };
  }

  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T | null> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/api/graphql`;
    const response = await providerFetch(this.config, url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.config.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (payload.errors?.length) return null;
    return payload.data ?? null;
  }

  private async getProjectMeta(): Promise<GitLabProject> {
    return this.request<GitLabProject>("GET", `/projects/${this.encodeProjectId()}`);
  }

  private namespacePaths(project: GitLabProject): string[] {
    const paths: string[] = [];
    if (project.namespace?.full_path) paths.push(project.namespace.full_path);
    if (project.path_with_namespace) paths.push(project.path_with_namespace);

    const segments = project.path_with_namespace.split("/");
    for (let i = segments.length - 1; i >= 1; i--) {
      paths.push(segments.slice(0, i).join("/"));
    }

    return [...new Set(paths.filter(Boolean))];
  }

  private mapStatuses(nodes: GitLabIssueStatus[]): ProviderOptions["statuses"] {
    const seen = new Set<string>();
    const statuses: ProviderOptions["statuses"] = [];
    for (const node of nodes) {
      if (!node.id || !node.name || seen.has(node.id)) continue;
      seen.add(node.id);
      statuses.push({ id: node.id, name: node.name });
    }
    return statuses;
  }

  private async fetchNamespaceStatuses(fullPath: string): Promise<ProviderOptions["statuses"]> {
    const data = await this.graphql<{
      namespace: { statuses: { nodes: GitLabIssueStatus[] } | null } | null;
    }>(
      `query NamespaceStatuses($fullPath: ID!) {
        namespace(fullPath: $fullPath) {
          statuses {
            nodes {
              id
              name
              color
            }
          }
        }
      }`,
      { fullPath },
    );

    const nodes = data?.namespace?.statuses?.nodes ?? [];
    return this.mapStatuses(nodes);
  }

  private async fetchAllowedStatuses(): Promise<ProviderOptions["statuses"]> {
    const data = await this.graphql<{
      workItemAllowedStatuses: { nodes: GitLabIssueStatus[] } | null;
    }>(
      `query AllowedStatuses {
        workItemAllowedStatuses {
          nodes {
            id
            name
            color
          }
        }
      }`,
    );

    const nodes = data?.workItemAllowedStatuses?.nodes ?? [];
    return this.mapStatuses(nodes);
  }

  private async listIssueStatuses(project: GitLabProject): Promise<ProviderOptions["statuses"]> {
    const defaults = [
      { id: "opened", name: "Opened" },
      { id: "closed", name: "Closed" },
    ];

    for (const path of this.namespacePaths(project)) {
      const statuses = await this.fetchNamespaceStatuses(path);
      if (statuses.length > 0) return statuses;
    }

    const allowed = await this.fetchAllowedStatuses();
    if (allowed.length > 0) return allowed;

    return defaults;
  }

  private async updateWorkItemStatus(issueIid: number, statusId: string): Promise<void> {
    const project = await this.getProjectMeta();
    const fullPath = project.path_with_namespace;

    const lookup = await this.graphql<{
      project: { workItem: { id: string } | null } | null;
    }>(
      `query WorkItemId($fullPath: ID!, $iid: String!) {
        project(fullPath: $fullPath) {
          workItem(iid: $iid) {
            id
          }
        }
      }`,
      { fullPath, iid: String(issueIid) },
    );

    const workItemId = lookup?.project?.workItem?.id;
    if (!workItemId) {
      throw new Error(`Could not resolve work item for issue !${issueIid}`);
    }

    const result = await this.graphql<{
      workItemUpdate: { errors: string[] } | null;
    }>(
      `mutation UpdateWorkItemStatus($id: WorkItemID!, $status: WorkItemStatusID!) {
        workItemUpdate(input: { id: $id, statusWidget: { status: $status } }) {
          errors
        }
      }`,
      { id: workItemId, status: statusId },
    );

    const errors = result?.workItemUpdate?.errors ?? [];
    if (errors.length > 0) {
      throw new Error(`GitLab status update failed: ${errors.join(", ")}`);
    }
  }

  async addComment(
    issueIid: number,
    body: string,
    opts: { internal: boolean },
  ): Promise<AddCommentResult> {
    const note = await this.request<GitLabNote>(
      "POST",
      `/projects/${this.encodeProjectId()}/issues/${issueIid}/notes`,
      {
        body,
        internal: opts.internal,
      },
    );

    return { noteId: String(note.id) };
  }

  async uploadFile(
    filename: string,
    content: Buffer,
    mimeType: string,
  ): Promise<UploadFileResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([content], { type: mimeType }),
      filename,
    );

    const url = `${this.apiBase}/projects/${this.encodeProjectId()}/uploads`;
    const response = await providerFetch(this.config, url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.config.token,
      },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab upload error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      alt: string;
      url: string;
      markdown: string;
    };

    const absoluteUrl = data.url.startsWith("http")
      ? data.url
      : `${this.config.baseUrl.replace(/\/$/, "")}${data.url}`;

    return {
      url: absoluteUrl,
      markdown: data.markdown,
    };
  }

  async addReaction(
    issueIid: number,
    noteId: string,
    emoji: string,
  ): Promise<void> {
    await this.request(
      "POST",
      `/projects/${this.encodeProjectId()}/issues/${issueIid}/notes/${noteId}/award_emoji`,
      { name: emoji },
    );
  }

  async listCommentsSince(issueIid: number, since: Date): Promise<ProviderNote[]> {
    const notes = await this.request<GitLabNote[]>(
      "GET",
      `/projects/${this.encodeProjectId()}/issues/${issueIid}/notes?sort=asc&per_page=100`,
    );

    return notes
      .filter((n) => new Date(n.created_at) > since)
      .map((n) => ({
        id: String(n.id),
        body: n.body,
        authorId: String(n.author.id),
        authorUsername: n.author.username,
        internal: n.internal ?? n.confidential ?? false,
        createdAt: new Date(n.created_at),
      }));
  }

  verifyWebhook(
    headers: Record<string, string>,
    _body: string,
    secret: string,
  ): boolean {
    const token =
      headers["x-gitlab-token"] ??
      headers["X-Gitlab-Token"] ??
      headers["X-GITLAB-TOKEN"];
    return token === secret;
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent | null {
    const data = payload as GitLabWebhookPayload;
    if (data.object_kind !== "note") return null;
    if (data.object_attributes?.noteable_type !== "Issue") return null;
    if (!data.issue || !data.object_attributes?.id) return null;

    return {
      type: "note_created",
      issueExternalId: String(data.issue.id),
      issueIid: data.issue.iid,
      noteId: String(data.object_attributes.id),
      noteBody: data.object_attributes.note ?? "",
      authorId: String(data.user?.id ?? 0),
      authorUsername: data.user?.username ?? "unknown",
      internal:
        data.object_attributes.internal ??
        data.object_attributes.confidential ??
        false,
      createdAt: new Date(data.object_attributes.created_at ?? Date.now()),
    };
  }

  async ensureWebhook(config: ProviderConfig): Promise<void> {
    if (!config.webhookUrl || !config.webhookSecret) {
      throw new Error("Webhook URL and secret are required");
    }

    const projectId = encodeURIComponent(config.projectId);
    const existing = await this.request<
      Array<{ id: number; url: string }>
    >("GET", `/projects/${projectId}/hooks`);

    const match = existing.find((h) => h.url === config.webhookUrl);
    if (match) {
      await this.request("PUT", `/projects/${projectId}/hooks/${match.id}`, {
        note_events: true,
        confidential_note_events: true,
        enable_ssl_verification: true,
        token: config.webhookSecret,
      });
      return;
    }

    await this.request("POST", `/projects/${projectId}/hooks`, {
      url: config.webhookUrl,
      note_events: true,
      confidential_note_events: true,
      enable_ssl_verification: true,
      token: config.webhookSecret,
    });
  }
}

export function createProvider(
  type: string,
  config: ProviderConfig,
): IssueProvider {
  switch (type) {
    case "gitlab":
      return new GitLabProvider(config);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
