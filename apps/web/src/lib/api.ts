import type { TeamEntitlementUsage } from "@servicebeard/shared/entitlements";
import type { AuthConfigResponse } from "@servicebeard/shared/login";
import type {
    AuthenticationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { redirect } from "@tanstack/react-router";

const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

export class EntitlementRequiredError extends ApiError {
  readonly entitlementCode: string;

  constructor(message: string, entitlementCode: string) {
    super(message, 402, {}, entitlementCode);
    this.name = "EntitlementRequiredError";
    this.entitlementCode = entitlementCode;
  }
}

type ConnectionTestResult = {
  ok: boolean;
  error?: string;
  status?: number;
  responseBody?: string;
  user?: { id: string; username: string };
};

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
      code?: string;
      fieldErrors?: Record<string, string>;
    };
    if (res.status === 402 && body.code) {
      const entitlementError = new EntitlementRequiredError(
        body.error ?? "Entitlement required",
        body.code,
      );
      const { handleApiError } = await import("@extensions");
      const entitlementRedirect = handleApiError(entitlementError, { requestPath: path });
      if (entitlementRedirect) {
        throw redirect(entitlementRedirect);
      }
      throw entitlementError;
    }
    throw new ApiError(
      body.error ?? `Request failed: ${res.status}`,
      res.status,
      body.fieldErrors ?? {},
      body.code,
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
    request<{
      teams: Array<{
        id: string;
        name: string;
        slug: string;
        role: string;
        subscriptionRequired?: boolean;
      }>;
    }>("/teams"),

  createTeam: (data: { name: string; slug: string }) =>
    request<{ id: string; name: string; slug: string }>("/teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTeam: (teamId: string) =>
    request<{ id: string; name: string; slug: string; members: unknown[] }>(`/teams/${teamId}`),

  updateTeam: (teamId: string, data: { name?: string; slug?: string }) =>
    request<{ id: string; name: string; slug: string }>(`/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTeam: (teamId: string) =>
    request<{ ok: boolean }>(`/teams/${teamId}`, { method: "DELETE" }),

  getProjects: (teamId: string) =>
    request<{ projects: Project[]; entitlements: TeamEntitlementUsage | null }>(
      `/teams/${teamId}/projects`,
    ),

  getProject: (teamId: string, projectId: string) =>
    request<Project & { rules: Rule[]; entitlements: TeamEntitlementUsage | null }>(
      `/teams/${teamId}/projects/${projectId}`,
    ),

  createProject: (teamId: string, data: CreateProjectInput) =>
    request<Project>(`/teams/${teamId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProject: (teamId: string, projectId: string, data: UpdateProjectInput) =>
    request(`/teams/${teamId}/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProject: (teamId: string, projectId: string) =>
    request(`/teams/${teamId}/projects/${projectId}`, { method: "DELETE" }),

  testMail: (teamId: string, projectId: string, data: MailConfig) =>
    request<ConnectionTestResult>(
      `/teams/${teamId}/projects/${projectId}/test-mail`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  testMailForTeam: (teamId: string, data: MailConfig) =>
    request<ConnectionTestResult>(`/teams/${teamId}/test-mail`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  testProvider: (teamId: string, projectId: string, data: ProviderConfig) =>
    request<ConnectionTestResult>(
      `/teams/${teamId}/projects/${projectId}/test-provider`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  testProviderForTeam: (teamId: string, data: ProviderConfig) =>
    request<ConnectionTestResult>(
      `/teams/${teamId}/test-provider`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getGithubAppConfig: () =>
    request<GithubAppConfig>("/github-app/config"),

  githubAppInstallPath(
    teamId: string,
    baseUrl: string,
    options?: { popup?: boolean; returnTo?: string },
  ) {
    const params = new URLSearchParams({ baseUrl });
    if (options?.popup) params.set("popup", "1");
    else if (options?.returnTo) params.set("returnTo", options.returnTo);
    return `/api/teams/${encodeURIComponent(teamId)}/github-app/install?${params.toString()}`;
  },

  lookupGithubRepositoryInstallation: (
    teamId: string,
    baseUrl: string,
    repository: string,
  ) => {
    const params = new URLSearchParams({ baseUrl, repository });
    return request<GithubRepositoryInstallationLookup>(
      `/teams/${teamId}/github-app/repository-installation?${params.toString()}`,
    );
  },

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
    request<MailboxSnapshot>(`/teams/${teamId}/projects/${projectId}/mailbox-snapshot?limit=${limit}`),

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

  getSyncErrors: (teamId: string, projectId: string) =>
    request<{ errors: ProjectSyncError[] }>(
      `/teams/${teamId}/projects/${projectId}/sync-errors`,
    ),

  dismissSyncError: (teamId: string, projectId: string, errorId: string) =>
    request<{ ok: boolean }>(
      `/teams/${teamId}/projects/${projectId}/sync-errors/${errorId}/dismiss`,
      { method: "POST" },
    ),

  dismissAllSyncErrors: (teamId: string, projectId: string) =>
    request<{ ok: boolean; dismissed: number }>(
      `/teams/${teamId}/projects/${projectId}/sync-errors/dismiss-all`,
      { method: "POST" },
    ),

  getThread: (teamId: string, projectId: string, threadId: string) =>
    request<{ thread: ThreadDetail }>(
      `/teams/${teamId}/projects/${projectId}/threads/${threadId}`,
    ),

  inviteMember: (teamId: string, data: { email: string; role: string }) =>
    request(`/teams/${teamId}/members`, { method: "POST", body: JSON.stringify(data) }),

  removeMember: (teamId: string, memberId: string) =>
    request(`/teams/${teamId}/members/${memberId}`, { method: "DELETE" }),
};

export interface GithubAppConfig {
  enabled: boolean;
  configured: boolean;
}

export interface GithubRepositoryInstallationLookup {
  installed: boolean;
  repository?: string;
  installationId?: string;
  accountLogin?: string | null;
  settingsUrl?: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  provider: string;
  providerBaseUrl: string;
  providerProjectId: string;
  providerGithubInstallationId?: string | null;
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
  webhookUrl: string;
  isActive: boolean;
  inboundAckEnabled: boolean;
  inboundAckCcMailbox: boolean;
  inboundAckTemplate: string;
  outboundCommentTemplate: string;
  outboundCommentCcMailbox: boolean;
  inboundIssueTemplate: string;
  inboundCommentTemplate: string;
  imapMarkIngestedAsSeen: boolean;
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

export interface ProjectSyncError {
  id: string;
  projectId: string;
  category: "mail" | "provider";
  operation: string;
  message: string;
  status: number | null;
  responseBody: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  dismissedAt: string | null;
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

export type GithubProviderAuthType = "pat" | "github_app";

export interface ProviderConfig {
  provider: string;
  providerBaseUrl: string;
  providerProjectId: string;
  providerToken?: string;
  providerGithubAuthType?: GithubProviderAuthType;
  providerGithubInstallationId?: string;
  providerTlsInsecure?: boolean;
  providerCaCert?: string | null;
}

export interface CreateProjectInput extends MailConfig, ProviderConfig {
  name: string;
  slug: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  isActive?: boolean;
  inboundAckEnabled?: boolean;
  inboundAckCcMailbox?: boolean;
  inboundAckTemplate?: string;
  outboundCommentTemplate?: string;
  outboundCommentCcMailbox?: boolean;
  inboundIssueTemplate?: string;
  inboundCommentTemplate?: string;
  imapMarkIngestedAsSeen?: boolean;
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
  inReplyTo: string | null;
  references: string[];
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  date: string | null;
}

export interface MailboxSnapshot {
  supportEmail: string;
  projectCreatedAt: string;
  messages: MailboxSnapshotMessage[];
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
