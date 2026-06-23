export interface ProviderNote {
  id: string;
  body: string;
  authorId: string;
  authorUsername: string;
  internal: boolean;
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
}

export interface NormalizedWebhookEvent {
  type: "note_created";
  issueExternalId: string;
  issueIid: number;
  noteId: string;
  noteBody: string;
  authorId: string;
  authorUsername: string;
  internal: boolean;
  createdAt: Date;
}

export interface ProviderConfig {
  baseUrl: string;
  projectId: string;
  token: string;
  webhookUrl?: string;
  webhookSecret?: string;
  tlsInsecure?: boolean;
  caCert?: string | null;
}

export interface UploadFileResult {
  url: string;
  markdown: string;
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
  addReaction(issueIid: number, noteId: string, emoji: string): Promise<void>;
  listCommentsSince(issueIid: number, since: Date): Promise<ProviderNote[]>;
  listProjectOptions(): Promise<ProviderOptions>;
  verifyWebhook(headers: Record<string, string>, body: string, secret: string): boolean;
  parseWebhook(payload: unknown): NormalizedWebhookEvent | null;
  ensureWebhook(config: ProviderConfig): Promise<void>;
  getCurrentUser(): Promise<{ id: string; username: string }>;
}
