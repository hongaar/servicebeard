import { parseGithubRepository } from "@servicebeard/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import { githubApiErrorMessage } from "./error-messages";
import { ProviderApiError } from "./errors";
import { getGithubAppBotUser, resolveGithubAccessToken } from "./github-app";
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
import { assertNonEmptyUpload } from "./upload";

interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  type?: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  html_url: string;
  state: string;
}

interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser | null;
  created_at: string;
}

interface GitHubLabel {
  name: string;
  color: string;
}

interface GitHubWebhookPayload {
  action?: string;
  issue?: { id: number; number: number };
  comment?: {
    id: number;
    body: string;
    user?: GitHubUser | null;
    created_at?: string;
  };
}

export class GitHubApiError extends ProviderApiError {
  constructor(status: number, message: string, responseBody?: string) {
    super(status, message, "GitHubApiError", responseBody);
  }
}

function parseRepository(projectId: string): { owner: string; repo: string } {
  const slug = parseGithubRepository(projectId);
  const [owner, repo] = slug.split("/");
  return { owner: owner!, repo: repo! };
}

function apiBase(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  try {
    const host = new URL(normalized).hostname;
    if (host === "github.com") {
      return "https://api.github.com";
    }
  } catch {
    // fall through
  }
  return `${normalized}/api/v3`;
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

const GITHUB_REACTIONS: Record<string, string> = {
  "+1": "+1",
  "-1": "-1",
  laugh: "laugh",
  confused: "confused",
  heart: "heart",
  hooray: "hooray",
  rocket: "rocket",
  eyes: "eyes",
  "e-mail": "rocket",
};

/** Orphan branch for email attachments; no history shared with the default branch. */
export const GITHUB_ATTACHMENTS_BRANCH = "servicebeard-attachments";

/** Same-repo raw URL for issue markdown; works for private repos when the viewer has access. */
export function githubIssueAttachmentUrl(
  baseUrl: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
): string {
  const base = baseUrl.replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/${owner}/${repo}/raw/${branch}/${encodedPath}`;
}

export class GitHubProvider implements IssueProvider {
  readonly name = "github";

  constructor(private config: ProviderConfig) {}

  private get repo(): { owner: string; repo: string } {
    return parseRepository(this.config.projectId);
  }

  private repoPath(): string {
    const { owner, repo } = this.repo;
    return `/repos/${owner}/${repo}`;
  }

  private async getAttachmentsBranchHead(): Promise<string | null> {
    try {
      const ref = await this.request<{ object: { sha: string } }>(
        "GET",
        `${this.repoPath()}/git/ref/heads/${GITHUB_ATTACHMENTS_BRANCH}`,
        undefined,
        { quiet404: true },
      );
      return ref.object.sha;
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  private async createAttachmentCommit(
    path: string,
    content: Buffer,
    message: string,
    parentSha: string | null,
  ): Promise<string> {
    const blob = await this.request<{ sha: string }>(
      "POST",
      `${this.repoPath()}/git/blobs`,
      {
        content: content.toString("base64"),
        encoding: "base64",
      },
    );

    let baseTree: string | undefined;
    if (parentSha) {
      const parent = await this.request<{ tree: { sha: string } }>(
        "GET",
        `${this.repoPath()}/git/commits/${parentSha}`,
      );
      baseTree = parent.tree.sha;
    }

    const tree = await this.request<{ sha: string }>(
      "POST",
      `${this.repoPath()}/git/trees`,
      {
        ...(baseTree ? { base_tree: baseTree } : {}),
        tree: [
          {
            path,
            mode: "100644",
            type: "blob",
            sha: blob.sha,
          },
        ],
      },
    );

    const commit = await this.request<{ sha: string }>(
      "POST",
      `${this.repoPath()}/git/commits`,
      {
        message,
        tree: tree.sha,
        parents: parentSha ? [parentSha] : [],
      },
    );

    return commit.sha;
  }

  private async advanceAttachmentsBranch(
    commitSha: string,
    parentSha: string | null,
  ): Promise<boolean> {
    if (parentSha) {
      await this.request(
        "PATCH",
        `${this.repoPath()}/git/refs/heads/${GITHUB_ATTACHMENTS_BRANCH}`,
        { sha: commitSha },
      );
      return true;
    }

    try {
      await this.request("POST", `${this.repoPath()}/git/refs`, {
        ref: `refs/heads/${GITHUB_ATTACHMENTS_BRANCH}`,
        sha: commitSha,
      });
      return true;
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 422) {
        return false;
      }
      throw err;
    }
  }

  private async commitAttachment(
    path: string,
    content: Buffer,
    message: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parentSha = await this.getAttachmentsBranchHead();
        const commitSha = await this.createAttachmentCommit(
          path,
          content,
          message,
          parentSha,
        );

        const advanced = await this.advanceAttachmentsBranch(
          commitSha,
          parentSha,
        );
        if (advanced) {
          return;
        }
      } catch (err) {
        if (
          attempt === 0 &&
          err instanceof GitHubApiError &&
          err.status === 422
        ) {
          continue;
        }
        throw err;
      }
    }

    throw new GitHubApiError(
      422,
      "Could not update attachments branch after retry",
    );
  }

  private rawContentUrl(branch: string, path: string): string {
    const { owner, repo } = this.repo;
    return githubIssueAttachmentUrl(
      this.config.baseUrl,
      owner,
      repo,
      branch,
      path,
    );
  }

  private async authHeaders(
    extra?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const token = await resolveGithubAccessToken(this.config);
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "servicebeard",
      "X-GitHub-Api-Version": "2022-11-28",
      ...extra,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet404?: boolean },
  ): Promise<T> {
    const url = `${apiBase(this.config.baseUrl)}${path}`;
    const response = await providerFetch(this.config, url, {
      method,
      headers: await this.authHeaders(
        body ? { "Content-Type": "application/json" } : undefined,
      ),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      const status = response.status;
      if (!(options?.quiet404 && status === 404)) {
        logProvider(
          status === 404 ? "debug" : "error",
          "GitHub API request failed",
          {
            method,
            path,
            status,
            bodyPreview: text.slice(0, 500),
          },
        );
      }
      throw new GitHubApiError(
        status,
        githubApiErrorMessage(status, path, text),
        text,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async getCurrentUser(): Promise<{ id: string; username: string }> {
    if (this.config.githubInstallationId) {
      return getGithubAppBotUser(
        this.config.baseUrl,
        this.config.githubInstallationId,
      );
    }
    const user = await this.request<GitHubUser>("GET", "/user");
    return { id: String(user.id), username: user.login };
  }

  async createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    const body: Record<string, unknown> = {
      title: input.title,
      body: input.description,
      labels: input.labels,
    };

    if (input.assigneeId) {
      const login = await this.resolveAssigneeLogin(input.assigneeId);
      if (login) body.assignees = [login];
    }

    if (input.status === "closed") {
      body.state = "closed";
    }

    const issue = await this.request<GitHubIssue>(
      "POST",
      `${this.repoPath()}/issues`,
      body,
    );

    return {
      externalId: String(issue.id),
      iid: issue.number,
      url: issue.html_url,
    };
  }

  private async resolveAssigneeLogin(
    assigneeId: string,
  ): Promise<string | null> {
    const collaborators = await this.request<GitHubUser[]>(
      "GET",
      `${this.repoPath()}/collaborators?affiliation=direct&per_page=100`,
    );
    const match = collaborators.find((user) => String(user.id) === assigneeId);
    return match?.login ?? null;
  }

  async listProjectOptions(): Promise<ProviderOptions> {
    const [labels, members] = await Promise.all([
      this.request<GitHubLabel[]>(
        "GET",
        `${this.repoPath()}/labels?per_page=100`,
      ),
      this.request<GitHubUser[]>(
        "GET",
        `${this.repoPath()}/collaborators?affiliation=direct&per_page=100`,
      ),
    ]);

    return {
      labels: labels.map((label) => ({
        name: label.name,
        color: label.color ? `#${label.color}` : null,
      })),
      members: members.map((member) => ({
        id: String(member.id),
        name: member.name?.trim() || member.login,
        username: member.login,
      })),
      statuses: [
        { id: "open", name: "Open" },
        { id: "closed", name: "Closed" },
      ],
    };
  }

  async addComment(
    issueIid: number,
    body: string,
    _opts: { internal: boolean },
  ): Promise<AddCommentResult> {
    const comment = await this.request<GitHubComment>(
      "POST",
      `${this.repoPath()}/issues/${issueIid}/comments`,
      { body },
    );

    return {
      noteId: String(comment.id),
      createdAt: new Date(comment.created_at),
    };
  }

  async uploadFile(
    filename: string,
    content: Buffer,
    _mimeType: string,
  ): Promise<UploadFileResult> {
    const normalized = assertNonEmptyUpload(content, filename);
    const safeName = filename.replace(/[^\w.\-()+ ]/g, "_") || "attachment";
    const path = `.servicebeard/attachments/${crypto.randomUUID()}/${safeName}`;
    const branch = GITHUB_ATTACHMENTS_BRANCH;

    await this.commitAttachment(
      path,
      normalized,
      `Add email attachment ${safeName}`,
    );

    const assetUrl = this.rawContentUrl(branch, path);

    return {
      url: assetUrl,
      markdown: `![${filename}](${assetUrl})`,
    };
  }

  async downloadFile(url: string): Promise<DownloadedFile | null> {
    const response = await providerFetch(this.config, url, {
      headers: await this.authHeaders(),
    });

    if (!response.ok) {
      logProvider("warn", "GitHub file download failed", {
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
      logProvider("warn", "GitHub file download returned non-image payload", {
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
      logProvider("debug", "GitHub file download skipped, unknown image type", {
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
    const reaction = GITHUB_REACTIONS[emoji];
    if (!reaction) return;

    try {
      await this.request(
        "POST",
        `${this.repoPath()}/issues/comments/${noteId}/reactions`,
        { content: reaction },
        { quiet404: true },
      );
    } catch (err) {
      if (
        err instanceof GitHubApiError &&
        (err.status === 404 || err.status === 403 || err.status === 422)
      ) {
        return;
      }
      logProvider("warn", "GitHub reaction failed", {
        noteId,
        emoji,
        status: err instanceof GitHubApiError ? err.status : undefined,
      });
    }
  }

  async listCommentsSince(
    issueIid: number,
    since: Date,
  ): Promise<ProviderNote[] | null> {
    try {
      const comments = await this.request<GitHubComment[]>(
        "GET",
        `${this.repoPath()}/issues/${issueIid}/comments?per_page=100`,
      );

      return comments
        .filter(
          (comment) =>
            new Date(comment.created_at).getTime() >= since.getTime(),
        )
        .map((comment) => ({
          id: String(comment.id),
          body: comment.body,
          authorId: String(comment.user?.id ?? 0),
          authorName: comment.user?.name?.trim() || null,
          authorUsername: comment.user?.login ?? "unknown",
          internal: false,
          system: comment.user?.type === "Bot",
          createdAt: new Date(comment.created_at),
        }));
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  verifyWebhook(
    headers: Record<string, string>,
    body: string,
    secret: string,
  ): boolean {
    const signature =
      headers["x-hub-signature-256"] ??
      headers["X-Hub-Signature-256"] ??
      headers["X-HUB-SIGNATURE-256"];
    if (!signature) return false;

    const expected =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    try {
      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);
      if (sigBuf.length !== expectedBuf.length) return false;
      return timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent | null {
    const data = payload as GitHubWebhookPayload;
    if (data.action !== "created") return null;
    if (!data.issue || !data.comment?.id) return null;
    if (data.comment.user?.type === "Bot") return null;

    return {
      type: "note_created",
      issueExternalId: String(data.issue.id),
      issueIid: data.issue.number,
      noteId: String(data.comment.id),
      noteBody: data.comment.body ?? "",
      authorId: String(data.comment.user?.id ?? 0),
      authorName: data.comment.user?.name?.trim() || null,
      authorUsername: data.comment.user?.login ?? "unknown",
      internal: false,
      system: false,
      createdAt: new Date(data.comment.created_at ?? Date.now()),
    };
  }

  async ensureWebhook(config: ProviderConfig): Promise<void> {
    if (!config.webhookUrl || !config.webhookSecret) {
      throw new Error("Webhook URL and secret are required");
    }

    const existing = await this.request<
      Array<{ id: number; config: { url?: string } }>
    >("GET", `${this.repoPath()}/hooks`);

    const match = existing.find(
      (hook) => hook.config.url === config.webhookUrl,
    );
    if (match) {
      await this.request("PATCH", `${this.repoPath()}/hooks/${match.id}`, {
        active: true,
        events: ["issue_comment"],
        config: {
          url: config.webhookUrl,
          content_type: "json",
          secret: config.webhookSecret,
          insecure_ssl: "0",
        },
      });
      return;
    }

    await this.request("POST", `${this.repoPath()}/hooks`, {
      name: "web",
      active: true,
      events: ["issue_comment"],
      config: {
        url: config.webhookUrl,
        content_type: "json",
        secret: config.webhookSecret,
        insecure_ssl: "0",
      },
    });
  }
}
