export interface ProviderNote {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
  internal: boolean;
  system: boolean;
  createdAt: Date;
}

export interface ProviderLabel {
  name: string;
  color: string | null;
}

export interface ProviderMember {
  id: string;
  name: string;
  username: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
}

export interface ProviderOptions {
  labels: ProviderLabel[];
  members: ProviderMember[];
  statuses: ProviderStatus[];
}

export interface CreateIssueInput {
  title: string;
  description: string;
  labels?: string[];
  assigneeId?: string | null;
  status?: string | null;
}

export interface CreateIssueResult {
  externalId: string;
  iid: number;
  url: string;
}

export interface AddCommentResult {
  noteId: string;
  createdAt: Date;
}

export interface NormalizedWebhookEvent {
  type: "note_created";
  issueExternalId: string;
  issueIid: number;
  noteId: string;
  noteBody: string;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
  internal: boolean;
  system: boolean;
  createdAt: Date;
}

export interface ProviderConfig {
  baseUrl: string;
  projectId: string;
  token: string;
  /** When set, mint short-lived installation tokens via the configured GitHub App. */
  githubInstallationId?: string | null;
  /** Overrides automatic provider API rate-limit bucket grouping. */
  rateLimitBucketKey?: string | null;
  webhookUrl?: string;
  webhookSecret?: string;
  tlsInsecure?: boolean;
  caCert?: string | null;
}

export interface UploadFileResult {
  url: string;
  markdown: string;
}

export interface DownloadedFile {
  content: Buffer;
  contentType: string;
}

export interface IssueState {
  closed: boolean;
  statusId: string | null;
}

export interface IssueProvider {
  readonly name: string;
  createIssue(input: CreateIssueInput): Promise<CreateIssueResult>;
  addComment(
    issueIid: number,
    body: string,
    opts: { internal: boolean },
  ): Promise<AddCommentResult>;
  uploadFile(
    filename: string,
    content: Buffer,
    mimeType: string,
  ): Promise<UploadFileResult>;
  downloadFile(url: string): Promise<DownloadedFile | null>;
  addReaction(issueIid: number, noteId: string, emoji: string): Promise<void>;
  listCommentsSince(
    issueIid: number,
    since: Date,
  ): Promise<ProviderNote[] | null>;
  listProjectOptions(): Promise<ProviderOptions>;
  verifyWebhook(
    headers: Record<string, string>,
    body: string,
    secret: string,
  ): boolean;
  parseWebhook(payload: unknown): NormalizedWebhookEvent | null;
  ensureWebhook(config: ProviderConfig): Promise<void>;
  getCurrentUser(): Promise<{ id: string; username: string }>;
  getIssueState(issueIid: number): Promise<IssueState | null>;
  getDefaultOpenStatus(): Promise<string>;
  updateIssueStatus(issueIid: number, status: string): Promise<void>;
}
