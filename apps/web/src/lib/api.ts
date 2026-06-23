import type { AuthConfigResponse } from "@serviceboard/shared/login";
import type {
    AuthenticationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/browser";

const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      fieldErrors?: Record<string, string>;
    };
    throw new ApiError(
      body.error ?? `Request failed: ${res.status}`,
      res.status,
      body.fieldErrors ?? {},
    );
  }

  return res.json();
}

export const api = {
  getMe: () => request<{ user: { id: string; email: string; name: string | null } | null }>("/auth/me"),
  getAuthConfig: () => request<AuthConfigResponse>("/auth/config"),
  loginWithProvider: (
    provider: string,
    data: {
      email: string;
      password: string;
      name?: string;
      mode: "login" | "signup";
    },
  ) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      `/auth/login/${provider}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  passkeyRegisterOptions: (provider: string, data: { email: string; name: string }) =>
    request<PublicKeyCredentialCreationOptionsJSON>(
      `/auth/login/${provider}/passkey/register/options`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  passkeyRegisterVerify: (
    provider: string,
    data: { email: string; name: string; response: RegistrationResponseJSON },
  ) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      `/auth/login/${provider}/passkey/register/verify`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  passkeyAuthenticateOptions: (provider: string) =>
    request<PublicKeyCredentialRequestOptionsJSON>(
      `/auth/login/${provider}/passkey/authenticate/options`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  passkeyAuthenticateVerify: (
    provider: string,
    data: { response: AuthenticationResponseJSON },
  ) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      `/auth/login/${provider}/passkey/authenticate/verify`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  getTeams: () =>
    request<{ teams: Array<{ id: string; name: string; slug: string; role: string }> }>("/teams"),

  createTeam: (data: { name: string; slug: string }) =>
    request("/teams", { method: "POST", body: JSON.stringify(data) }),

  getTeam: (teamId: string) => request(`/teams/${teamId}`),

  getProjects: (teamId: string) =>
    request<{ projects: Project[] }>(`/teams/${teamId}/projects`),

  getProject: (teamId: string, projectId: string) =>
    request<Project & { rules: Rule[] }>(`/teams/${teamId}/projects/${projectId}`),

  createProject: (teamId: string, data: CreateProjectInput) =>
    request(`/teams/${teamId}/projects`, { method: "POST", body: JSON.stringify(data) }),

  updateProject: (teamId: string, projectId: string, data: UpdateProjectInput) =>
    request(`/teams/${teamId}/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProject: (teamId: string, projectId: string) =>
    request(`/teams/${teamId}/projects/${projectId}`, { method: "DELETE" }),

  testMail: (teamId: string, projectId: string, data: MailConfig) =>
    request(`/teams/${teamId}/projects/${projectId}/test-mail`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  testProvider: (teamId: string, projectId: string, data: ProviderConfig) =>
    request(`/teams/${teamId}/projects/${projectId}/test-provider`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getRules: (teamId: string, projectId: string) =>
    request<{ rules: Rule[] }>(`/teams/${teamId}/projects/${projectId}/rules`),

  createRule: (teamId: string, projectId: string, data: CreateRuleInput) =>
    request(`/teams/${teamId}/projects/${projectId}/rules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRule: (teamId: string, projectId: string, ruleId: string, data: Partial<CreateRuleInput>) =>
    request(`/teams/${teamId}/projects/${projectId}/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRule: (teamId: string, projectId: string, ruleId: string) =>
    request(`/teams/${teamId}/projects/${projectId}/rules/${ruleId}`, {
      method: "DELETE",
    }),

  getProviderOptions: (teamId: string, projectId: string) =>
    request<ProviderOptions>(`/teams/${teamId}/projects/${projectId}/provider-options`),

  getMailboxSnapshot: (teamId: string, projectId: string, limit = 20) =>
    request<{ messages: MailboxSnapshotMessage[] }>(
      `/teams/${teamId}/projects/${projectId}/mailbox-snapshot?limit=${limit}`,
    ),

  testRule: (
    teamId: string,
    projectId: string,
    data: TestRuleInput,
    limit = 20,
  ) =>
    request<RuleTestResult>(
      `/teams/${teamId}/projects/${projectId}/rules/test?limit=${limit}`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  getThreads: (teamId: string, projectId: string) =>
    request<{ threads: Thread[] }>(`/teams/${teamId}/projects/${projectId}/threads`),

  getThread: (teamId: string, projectId: string, threadId: string) =>
    request<{ thread: ThreadDetail }>(
      `/teams/${teamId}/projects/${projectId}/threads/${threadId}`,
    ),

  inviteMember: (teamId: string, data: { email: string; role: string }) =>
    request(`/teams/${teamId}/members`, { method: "POST", body: JSON.stringify(data) }),

  removeMember: (teamId: string, memberId: string) =>
    request(`/teams/${teamId}/members/${memberId}`, { method: "DELETE" }),
};

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  provider: string;
  providerBaseUrl: string;
  providerProjectId: string;
  providerTlsInsecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  imapPollIntervalSeconds: number;
  commentPollIntervalSeconds: number;
  webhookEnabled: boolean;
  webhookUrl: string;
  isActive: boolean;
  inboundAckEnabled: boolean;
  inboundAckTemplate: string;
}

export interface Rule {
  id: string;
  projectId: string;
  name: string;
  priority: number;
  isEnabled: boolean;
  matchSender: string | null;
  matchSubject: string | null;
  matchBody: string | null;
  actionCreateIssue: boolean;
  actionStatus: string | null;
  actionLabels: string[];
  actionAssigneeId: string | null;
}

export interface ThreadMessage {
  id: string;
  direction: string;
  messageId: string;
  subject: string | null;
  processedAt: string;
}

export interface ThreadMessageDetail extends ThreadMessage {
  inReplyTo: string | null;
  references: string[];
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  bodyText: string | null;
  externalNoteId: string | null;
}

export interface Thread {
  id: string;
  issueIid: number;
  issueUrl: string;
  originalSenderEmail: string;
  originalSenderName: string | null;
  subjectNormalized: string;
  updatedAt: string;
  messages: ThreadMessage[];
}

export interface ThreadDetail {
  id: string;
  projectId: string;
  externalIssueId: string;
  issueIid: number;
  issueUrl: string;
  originalSenderEmail: string;
  originalSenderName: string | null;
  subjectNormalized: string;
  lastSeenNoteAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessageDetail[];
}

export interface MailConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
}

export interface ProviderConfig {
  provider: string;
  providerBaseUrl: string;
  providerProjectId: string;
  providerToken: string;
  providerTlsInsecure?: boolean;
  providerCaCert?: string | null;
}

export interface CreateProjectInput extends MailConfig, ProviderConfig {
  name: string;
  slug: string;
  imapPollIntervalSeconds?: number;
  commentPollIntervalSeconds?: number;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  isActive?: boolean;
  webhookEnabled?: boolean;
  inboundAckEnabled?: boolean;
  inboundAckTemplate?: string;
}

export interface CreateRuleInput {
  name: string;
  priority?: number;
  isEnabled?: boolean;
  matchSender?: string | null;
  matchSubject?: string | null;
  matchBody?: string | null;
  actionCreateIssue?: boolean;
  actionStatus?: string | null;
  actionLabels?: string[];
  actionAssigneeId?: string | null;
}

export interface ProviderOptions {
  labels: Array<{ name: string; color: string | null }>;
  members: Array<{ id: string; name: string; username: string }>;
  statuses: Array<{ id: string; name: string }>;
}

export interface MailboxSnapshotMessage {
  uid: number;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string;
  body: string;
  messageId: string;
  date: string | null;
}

export interface TestRuleInput {
  matchSender?: string | null;
  matchSubject?: string | null;
  matchBody?: string | null;
  isEnabled?: boolean;
}

export interface RuleTestResult {
  results: Array<{
    uid: number;
    fromEmail: string;
    fromName: string | null;
    subject: string;
    bodyPreview: string;
    date: string | null;
    matched: boolean;
  }>;
  matchedCount: number;
  total: number;
}
