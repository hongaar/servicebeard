import {
  isLinearProjectId,
  isLinearTeamId,
  isServicebeardInternalContent,
  LINEAR_PROJECT_PREFIX,
  LINEAR_TEAM_PREFIX,
  linearSlugDisplayName,
  linearWorkspaceFromUrl,
  parseLinearIssueNumberFromUrl,
  parseLinearProjectSlugId,
  type ProviderProjectLabel,
} from "@servicebeard/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  linearApiErrorMessage,
  linearUploadErrorMessage,
} from "./error-messages";
import { ProviderApiError } from "./errors";
import { providerFetch } from "./http";
import { logProvider } from "./log";
import type {
  AddCommentResult,
  CreateIssueInput,
  CreateIssueResult,
  DownloadedFile,
  IssueProvider,
  NormalizedWebhookEvent,
  ProviderConfig,
  ProviderNote,
  ProviderOptions,
  UploadFileResult,
} from "./types";
import {
  assertNonEmptyUpload,
  signedUploadHeaders,
  uploadBlob,
} from "./upload";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LinearUser {
  id: string;
  name: string;
  displayName: string;
  email?: string | null;
}

interface LinearIssue {
  id: string;
  number: number;
  url: string;
  identifier: string;
}

interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: LinearUser | null;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

interface LinearWorkflowState {
  id: string;
  name: string;
}

interface LinearWebhookPayload {
  action?: string;
  type?: string;
  url?: string;
  createdAt?: string;
  webhookTimestamp?: number;
  actor?: { id?: string; type?: string; name?: string };
  data?: {
    id?: string;
    body?: string;
    issueId?: string;
    userId?: string;
    createdAt?: string;
  };
}

export class LinearApiError extends ProviderApiError {
  constructor(status: number, message: string, responseBody?: string) {
    super(status, message, "LinearApiError", responseBody);
  }
}

function inferImageContentTypeFromUrl(url: string): string | null {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    default:
      return null;
  }
}

export class LinearProvider implements IssueProvider {
  readonly name = "linear";

  private resolvedScope: { teamId: string; projectId?: string } | null = null;

  constructor(private config: ProviderConfig) {}

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: this.config.token,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
    options?: { quiet404?: boolean },
  ): Promise<T> {
    const response = await providerFetch(this.config, LINEAR_API_URL, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });

    const text = await response.text();
    if (!response.ok) {
      if (!(options?.quiet404 && response.status === 404)) {
        logProvider(
          response.status === 404 ? "debug" : "error",
          "Linear API request failed",
          {
            status: response.status,
            bodyPreview: text.slice(0, 500),
          },
        );
      }
      throw new LinearApiError(
        response.status,
        linearApiErrorMessage(response.status, text),
        text,
      );
    }

    const payload = JSON.parse(text) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      const message = payload.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ");
      throw new LinearApiError(400, message || "Linear GraphQL error", text);
    }

    if (!payload.data) {
      throw new LinearApiError(
        500,
        "Linear GraphQL response missing data",
        text,
      );
    }

    return payload.data;
  }

  private isTeamUuid(value: string): boolean {
    return UUID_RE.test(value);
  }

  private async resolveScope(): Promise<{
    teamId: string;
    projectId?: string;
  }> {
    if (this.resolvedScope) return this.resolvedScope;

    const projectId = this.config.projectId.trim();
    if (isLinearProjectId(projectId)) {
      this.resolvedScope = await this.resolveProjectScope(
        projectId.slice(LINEAR_PROJECT_PREFIX.length),
      );
      return this.resolvedScope;
    }

    if (isLinearTeamId(projectId)) {
      const ref = projectId.slice(LINEAR_TEAM_PREFIX.length).trim();
      const teamRef = ref.includes("/") ? (ref.split("/").pop() ?? ref) : ref;
      this.resolvedScope = await this.resolveTeamScope(teamRef);
      return this.resolvedScope;
    }

    if (this.isTeamUuid(projectId)) {
      this.resolvedScope = { teamId: projectId };
      return this.resolvedScope;
    }

    this.resolvedScope = await this.resolveTeamScope(projectId);
    return this.resolvedScope;
  }

  private async resolveTeamScope(
    teamRef: string,
  ): Promise<{ teamId: string; projectId?: string }> {
    if (this.isTeamUuid(teamRef)) {
      return { teamId: teamRef };
    }

    const data = await this.graphql<{
      teams: { nodes: Array<{ id: string; key: string }> };
    }>(
      `query TeamByKey($key: String!) {
        teams(filter: { key: { eq: $key } }, first: 1) {
          nodes { id key }
        }
      }`,
      { key: teamRef },
    );

    const team = data.teams.nodes[0];
    if (!team) {
      const projectScope = await this.resolveProjectScope(teamRef).catch(
        () => null,
      );
      if (projectScope) {
        return projectScope;
      }
      throw new LinearApiError(
        404,
        `Linear team not found for key "${teamRef}"`,
      );
    }

    return { teamId: team.id };
  }

  private async resolveProjectScope(
    ref: string,
  ): Promise<{ teamId: string; projectId: string }> {
    const slug = ref.includes("/") ? (ref.split("/").pop() ?? ref) : ref;
    const slugId = parseLinearProjectSlugId(slug);

    const data = await this.graphql<{
      projects: {
        nodes: Array<{ id: string; teams: { nodes: Array<{ id: string }> } }>;
      };
    }>(
      `query ProjectBySlugId($slugId: String!) {
        projects(filter: { slugId: { eq: $slugId } }, first: 1) {
          nodes {
            id
            teams { nodes { id } }
          }
        }
      }`,
      { slugId },
    );

    let project = data.projects.nodes[0];

    if (!project && UUID_RE.test(ref)) {
      const byId = await this.graphql<{
        project: { id: string; teams: { nodes: Array<{ id: string }> } } | null;
      }>(
        `query ProjectById($id: String!) {
          project(id: $id) {
            id
            teams { nodes { id } }
          }
        }`,
        { id: ref },
        { quiet404: true },
      );
      if (byId.project) {
        project = byId.project;
      }
    }

    const teamId = project?.teams.nodes[0]?.id;
    if (!project || !teamId) {
      throw new LinearApiError(404, `Linear project not found for "${ref}"`);
    }

    return { teamId, projectId: project.id };
  }

  private async resolveTeamId(): Promise<string> {
    const scope = await this.resolveScope();
    return scope.teamId;
  }

  private async issueByNumber(
    issueNumber: number,
  ): Promise<LinearIssue | null> {
    const scope = await this.resolveScope();
    const filter: Record<string, unknown> = {
      number: { eq: issueNumber },
    };
    if (scope.projectId) {
      filter.project = { id: { eq: scope.projectId } };
    } else {
      filter.team = { id: { eq: scope.teamId } };
    }

    const data = await this.graphql<{
      issues: { nodes: LinearIssue[] };
    }>(
      `query IssueByNumber($filter: IssueFilter!) {
        issues(filter: $filter, first: 1) {
          nodes { id number url identifier }
        }
      }`,
      { filter },
      { quiet404: true },
    );

    return data.issues.nodes[0] ?? null;
  }

  async getCurrentUser(): Promise<{ id: string; username: string }> {
    const data = await this.graphql<{ viewer: LinearUser }>(
      `query Viewer {
        viewer { id name displayName }
      }`,
    );
    return {
      id: data.viewer.id,
      username: data.viewer.displayName?.trim() || data.viewer.name,
    };
  }

  async resolveProjectDisplayLabel(): Promise<ProviderProjectLabel> {
    const projectId = this.config.projectId.trim();

    if (isLinearProjectId(projectId)) {
      const ref = projectId.slice(LINEAR_PROJECT_PREFIX.length).trim();
      const slug = ref.includes("/") ? (ref.split("/").pop() ?? ref) : ref;
      const slugId = parseLinearProjectSlugId(slug);

      const data = await this.graphql<{
        projects: {
          nodes: Array<{
            slugId: string;
            url: string;
          }>;
        };
      }>(
        `query ProjectDisplay($slugId: String!) {
          projects(filter: { slugId: { eq: $slugId } }, first: 1) {
            nodes {
              slugId
              url
            }
          }
        }`,
        { slugId },
      );

      const project = data.projects.nodes[0];
      if (project) {
        const workspace =
          linearWorkspaceFromUrl(project.url) ??
          (ref.includes("/") ? ref.split("/", 2)[0] : undefined);
        const name = linearSlugDisplayName(project.slugId);
        return {
          kind: "project",
          workspace: workspace ?? undefined,
          label: workspace ? `${workspace}/${name}` : name,
        };
      }
    }

    const teamRef = isLinearTeamId(projectId)
      ? (projectId.slice(LINEAR_TEAM_PREFIX.length).trim().split("/").pop() ??
        "")
      : projectId;

    if (!teamRef) {
      return { kind: "team", label: projectId };
    }

    if (this.isTeamUuid(teamRef)) {
      const data = await this.graphql<{
        team: {
          name: string;
          organization: { urlKey: string } | null;
        } | null;
      }>(
        `query TeamDisplayById($id: String!) {
          team(id: $id) {
            name
            organization { urlKey }
          }
        }`,
        { id: teamRef },
        { quiet404: true },
      );

      if (data.team) {
        const workspace = data.team.organization?.urlKey;
        return {
          kind: "team",
          workspace: workspace ?? undefined,
          label: workspace ? `${workspace}/${data.team.name}` : data.team.name,
        };
      }
    } else {
      const data = await this.graphql<{
        teams: {
          nodes: Array<{
            name: string;
            organization: { urlKey: string } | null;
          }>;
        };
      }>(
        `query TeamDisplayByKey($key: String!) {
          teams(filter: { key: { eq: $key } }, first: 1) {
            nodes {
              name
              organization { urlKey }
            }
          }
        }`,
        { key: teamRef },
      );

      const team = data.teams.nodes[0];
      if (team) {
        const workspace = team.organization?.urlKey;
        return {
          kind: "team",
          workspace: workspace ?? undefined,
          label: workspace ? `${workspace}/${team.name}` : team.name,
        };
      }
    }

    return { kind: "team", label: teamRef };
  }

  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    const scope = await this.resolveScope();
    const createInput: Record<string, unknown> = {
      teamId: scope.teamId,
      title: input.title,
      description: input.description,
    };

    if (scope.projectId) {
      createInput.projectId = scope.projectId;
    }

    if (input.assigneeId) {
      createInput.assigneeId = input.assigneeId;
    }

    if (input.status) {
      createInput.stateId = input.status;
    }

    if (input.labels?.length) {
      const labelIds = await this.resolveLabelIds(input.labels);
      if (labelIds.length > 0) {
        createInput.labelIds = labelIds;
      }
    }

    const data = await this.graphql<{
      issueCreate: { success: boolean; issue: LinearIssue | null };
    }>(
      `mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id number url identifier }
        }
      }`,
      { input: createInput },
    );

    if (!data.issueCreate.success || !data.issueCreate.issue) {
      throw new LinearApiError(400, "Linear issueCreate failed");
    }

    const issue = data.issueCreate.issue;
    return {
      externalId: issue.id,
      iid: issue.number,
      url: issue.url,
    };
  }

  async listProjectOptions(): Promise<ProviderOptions> {
    const teamId = await this.resolveTeamId();
    const data = await this.graphql<{
      team: {
        labels: { nodes: LinearLabel[] };
        members: { nodes: LinearUser[] };
        states: { nodes: LinearWorkflowState[] };
      } | null;
    }>(
      `query TeamOptions($teamId: String!) {
        team(id: $teamId) {
          labels { nodes { id name color } }
          members { nodes { id name displayName } }
          states { nodes { id name } }
        }
      }`,
      { teamId },
    );

    if (!data.team) {
      throw new LinearApiError(404, `Linear team not found: ${teamId}`);
    }

    return {
      labels: data.team.labels.nodes.map((label) => ({
        name: label.name,
        color: label.color ? `#${label.color.replace(/^#/, "")}` : null,
      })),
      members: data.team.members.nodes.map((member) => ({
        id: member.id,
        name: member.displayName?.trim() || member.name,
        username: member.displayName?.trim() || member.name,
      })),
      statuses: data.team.states.nodes.map((state) => ({
        id: state.id,
        name: state.name,
      })),
    };
  }

  private async resolveLabelIds(names: string[]): Promise<string[]> {
    const teamId = await this.resolveTeamId();
    const data = await this.graphql<{
      team: { labels: { nodes: LinearLabel[] } } | null;
    }>(
      `query TeamLabels($teamId: String!) {
        team(id: $teamId) {
          labels { nodes { id name } }
        }
      }`,
      { teamId },
    );

    const labels = data.team?.labels.nodes ?? [];
    return names
      .map((name) => labels.find((label) => label.name === name)?.id)
      .filter((id): id is string => Boolean(id));
  }

  async addComment(
    issueIid: number,
    body: string,
    opts: { internal: boolean },
  ): Promise<AddCommentResult> {
    const issue = await this.issueByNumber(issueIid);
    if (!issue) {
      throw new LinearApiError(404, `Linear issue #${issueIid} not found`);
    }

    const commentBody = opts.internal ? `[internal] ${body}` : body;

    const data = await this.graphql<{
      commentCreate: { success: boolean; comment: LinearComment | null };
    }>(
      `mutation CommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment { id body createdAt }
        }
      }`,
      {
        input: {
          issueId: issue.id,
          body: commentBody,
        },
      },
    );

    if (!data.commentCreate.success || !data.commentCreate.comment) {
      throw new LinearApiError(400, "Linear commentCreate failed");
    }

    const comment = data.commentCreate.comment;
    return {
      noteId: comment.id,
      createdAt: new Date(comment.createdAt),
    };
  }

  async uploadFile(
    filename: string,
    content: Buffer,
    mimeType: string,
  ): Promise<UploadFileResult> {
    const normalized = assertNonEmptyUpload(content, filename);
    const data = await this.graphql<{
      fileUpload: {
        success: boolean;
        uploadFile: {
          uploadUrl: string;
          assetUrl: string;
          headers: Array<{ key: string; value: string }>;
        } | null;
      };
    }>(
      `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile {
            uploadUrl
            assetUrl
            headers { key value }
          }
        }
      }`,
      {
        contentType: mimeType,
        filename,
        size: normalized.length,
      },
    );

    const upload = data.fileUpload.uploadFile;
    if (!data.fileUpload.success || !upload) {
      throw new LinearApiError(400, "Linear fileUpload failed");
    }

    const putHeaders = signedUploadHeaders(upload.headers, mimeType);
    const { body } = uploadBlob(normalized, putHeaders["Content-Type"]!);

    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: putHeaders,
      body,
    });

    if (!putResponse.ok) {
      const text = await putResponse.text();
      logProvider("error", "Linear file PUT upload failed", {
        status: putResponse.status,
        bodyPreview: text.slice(0, 500),
      });
      throw new LinearApiError(
        putResponse.status,
        linearUploadErrorMessage(putResponse.status, text),
        text,
      );
    }

    return {
      url: upload.assetUrl,
      markdown: `![${filename}](${upload.assetUrl})`,
    };
  }

  async downloadFile(url: string): Promise<DownloadedFile | null> {
    const response = await providerFetch(this.config, url, {
      headers: {
        Authorization: this.config.token,
      },
    });

    if (!response.ok) {
      logProvider("warn", "Linear file download failed", {
        url,
        status: response.status,
      });
      return null;
    }

    const headerType =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase() ?? "application/octet-stream";
    const content = Buffer.from(await response.arrayBuffer());

    if (headerType.includes("text/html") || content.length === 0) {
      logProvider("warn", "Linear file download returned non-image payload", {
        url,
        contentType: headerType,
        bytes: content.length,
      });
      return null;
    }

    const contentType = headerType.startsWith("image/")
      ? headerType
      : inferImageContentTypeFromUrl(url);

    if (!contentType) {
      logProvider("debug", "Linear file download skipped, unknown image type", {
        url,
        contentType: headerType,
      });
      return null;
    }

    return { content, contentType };
  }

  async addReaction(
    _issueIid: number,
    noteId: string,
    emoji: string,
  ): Promise<void> {
    if (emoji !== "e-mail" && emoji !== "rocket") return;

    try {
      await this.graphql(
        `mutation ReactionCreate($input: ReactionCreateInput!) {
          reactionCreate(input: $input) { success }
        }`,
        {
          input: {
            commentId: noteId,
            emoji: emoji === "e-mail" ? "📧" : "🚀",
          },
        },
        { quiet404: true },
      );
    } catch (err) {
      if (
        err instanceof LinearApiError &&
        (err.status === 404 || err.status === 403 || err.status === 400)
      ) {
        return;
      }
      logProvider("warn", "Linear reaction failed", {
        noteId,
        emoji,
        status: err instanceof LinearApiError ? err.status : undefined,
      });
    }
  }

  async listCommentsSince(
    issueIid: number,
    since: Date,
  ): Promise<ProviderNote[] | null> {
    const issue = await this.issueByNumber(issueIid);
    if (!issue) return null;

    const data = await this.graphql<{
      issue: {
        comments: { nodes: LinearComment[] };
      } | null;
    }>(
      `query IssueComments($issueId: String!, $since: DateTimeOrDuration!) {
        issue(id: $issueId) {
          comments(filter: { createdAt: { gte: $since } }) {
            nodes {
              id
              body
              createdAt
              user { id name displayName }
            }
          }
        }
      }`,
      { issueId: issue.id, since: since.toISOString() },
      { quiet404: true },
    );

    if (!data.issue) return null;

    return data.issue.comments.nodes.map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorId: comment.user?.id ?? "",
      authorName:
        comment.user?.displayName?.trim() || comment.user?.name || null,
      authorUsername:
        comment.user?.displayName?.trim() || comment.user?.name || "unknown",
      internal: isServicebeardInternalContent(comment.body),
      system: false,
      createdAt: new Date(comment.createdAt),
    }));
  }

  verifyWebhook(
    headers: Record<string, string>,
    body: string,
    secret: string,
  ): boolean {
    const signature =
      headers["linear-signature"] ??
      headers["Linear-Signature"] ??
      headers["LINEAR-SIGNATURE"];
    if (!signature || typeof signature !== "string") return false;

    try {
      const expected = createHmac("sha256", secret).update(body).digest();
      const received = Buffer.from(signature, "hex");
      if (received.length !== expected.length) return false;
      if (!timingSafeEqual(received, expected)) return false;
    } catch {
      return false;
    }

    try {
      const payload = JSON.parse(body) as { webhookTimestamp?: number };
      if (typeof payload.webhookTimestamp === "number") {
        if (Math.abs(Date.now() - payload.webhookTimestamp) > 60_000) {
          return false;
        }
      }
    } catch {
      return false;
    }

    return true;
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent | null {
    const data = payload as LinearWebhookPayload;
    if (data.action !== "create") return null;
    if (data.type !== "Comment") return null;
    if (!data.data?.id || !data.data.issueId) return null;
    if (data.actor?.type && data.actor.type !== "user") return null;

    const noteBody = data.data.body ?? "";
    if (isServicebeardInternalContent(noteBody)) {
      return {
        type: "note_created",
        issueExternalId: data.data.issueId,
        issueIid: parseLinearIssueNumberFromUrl(data.url) ?? 0,
        noteId: data.data.id,
        noteBody,
        authorId: data.data.userId ?? data.actor?.id ?? "",
        authorName: data.actor?.name?.trim() || null,
        authorUsername: data.actor?.name ?? "unknown",
        internal: true,
        system: false,
        createdAt: new Date(
          data.data.createdAt ?? data.createdAt ?? Date.now(),
        ),
      };
    }

    return {
      type: "note_created",
      issueExternalId: data.data.issueId,
      issueIid: parseLinearIssueNumberFromUrl(data.url) ?? 0,
      noteId: data.data.id,
      noteBody,
      authorId: data.data.userId ?? data.actor?.id ?? "",
      authorName: data.actor?.name?.trim() || null,
      authorUsername: data.actor?.name ?? "unknown",
      internal: false,
      system: false,
      createdAt: new Date(data.data.createdAt ?? data.createdAt ?? Date.now()),
    };
  }

  async ensureWebhook(config: ProviderConfig): Promise<void> {
    if (!config.webhookUrl || !config.webhookSecret) {
      throw new Error("Webhook URL and secret are required");
    }

    const teamId = await this.resolveTeamId();
    const existing = await this.graphql<{
      team: { webhooks: { nodes: Array<{ id: string; url: string }> } } | null;
    }>(
      `query TeamWebhooks($teamId: String!) {
        team(id: $teamId) {
          webhooks { nodes { id url } }
        }
      }`,
      { teamId },
    );

    const match = existing.team?.webhooks.nodes.find(
      (hook) => hook.url === config.webhookUrl,
    );
    if (match) {
      await this.graphql(
        `mutation WebhookUpdate($id: String!, $input: WebhookUpdateInput!) {
          webhookUpdate(id: $id, input: $input) { success }
        }`,
        {
          id: match.id,
          input: {
            enabled: true,
            resourceTypes: ["Comment"],
            secret: config.webhookSecret,
          },
        },
      );
      return;
    }

    await this.graphql(
      `mutation WebhookCreate($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook { id }
        }
      }`,
      {
        input: {
          teamId,
          url: config.webhookUrl,
          label: "ServiceBeard",
          resourceTypes: ["Comment"],
          secret: config.webhookSecret,
        },
      },
    );
  }
}
