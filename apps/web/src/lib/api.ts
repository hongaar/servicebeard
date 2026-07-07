import type { MailDiscoverResult } from "@servicebeard/shared";
import type {
  TeamEntitlementUsage,
  TeamListingMeta,
} from "@servicebeard/shared/entitlements";
import type {
  AuthConfigResponse,
  LoginProviderType,
} from "@servicebeard/shared/login";
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

export type AccountResponse = {
  user: { id: string; email: string; name: string | null; isAdmin: boolean };
  linkedProviders: Array<{
    provider: string;
    linkedAt: string;
    canUnlink: boolean;
  }>;
  availableProviders: Array<{
    type: LoginProviderType;
    label: string;
    linked: boolean;
  }>;
  hasLocalSignIn: boolean;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      const entitlementRedirect = handleApiError(entitlementError, {
        requestPath: path,
      });
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

export interface GlobalSearchResponse {
  teams: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    teamId: string;
    teamName: string;
  }>;
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    teamId: string;
    teamName: string;
  }>;
  conversations: Array<{
    id: string;
    subject: string;
    senderEmail: string;
    senderName: string | null;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
  }>;
  statusEvents: Array<{
    id: string;
    message: string;
    operation: string;
    severity: string;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
  }>;
}

export const api = {
  getMe: () =>
    request<{
      user: {
        id: string;
        email: string;
        name: string | null;
        isAdmin: boolean;
        emailVerified: boolean;
      } | null;
    }>("/auth/me"),
  getAdminStatus: () =>
    request<{ status: AdminStatusResponse | null }>("/admin/status"),
  runAdminStatusChecks: () =>
    request<AdminStatusResponse>("/admin/status/run", { method: "POST" }),
  listAuditLog: (params?: {
    search?: string;
    teamId?: string;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.teamId) query.set("teamId", params.teamId);
    if (params?.action) query.set("action", params.action);
    if (params?.resourceType) query.set("resourceType", params.resourceType);
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ entries: AdminAuditLogEntry[]; total: number }>(
      `/admin/audit-log${qs ? `?${qs}` : ""}`,
    );
  },
  listAdminTeams: (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ teams: AdminTeamOverview[]; total: number }>(
      `/admin/teams${qs ? `?${qs}` : ""}`,
    );
  },
  listAdminProjects: (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ projects: AdminProjectOverview[]; total: number }>(
      `/admin/projects${qs ? `?${qs}` : ""}`,
    );
  },
  listAdminStatusEvents: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ events: AdminStatusEvent[]; total: number }>(
      `/admin/status-events${qs ? `?${qs}` : ""}`,
    );
  },
  dismissAdminStatusEvent: (eventId: string) =>
    request<{ ok: boolean }>(`/admin/status-events/${eventId}/dismiss`, {
      method: "POST",
    }),
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
    request<
      | { user: { id: string; email: string; name: string | null } }
      | { requiresVerification: true; message: string }
    >(`/auth/login/${provider}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  passkeyRegisterOptions: (
    provider: string,
    data: { email: string; name: string },
  ) =>
    request<PublicKeyCredentialCreationOptionsJSON>(
      `/auth/login/${provider}/passkey/register/options`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  passkeyRegisterVerify: (
    provider: string,
    data: { email: string; name: string; response: RegistrationResponseJSON },
  ) =>
    request<
      | { user: { id: string; email: string; name: string | null } }
      | { requiresVerification: true; message: string }
    >(`/auth/login/${provider}/passkey/register/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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

  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  verifyEmail: (token: string) =>
    request<{ ok: boolean; message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  acceptInvite: (token: string) =>
    request<unknown>(`/teams/invites/${token}/accept`, { method: "POST" }),

  getPendingInvites: () =>
    request<{
      invites: Array<{
        id: string;
        teamId: string;
        teamName: string;
        role: string;
        expiresAt: string;
      }>;
    }>("/teams/invites/pending"),

  acceptPendingInvite: (inviteId: string) =>
    request<unknown>(`/teams/invites/pending/${inviteId}/accept`, {
      method: "POST",
    }),

  getAccount: () => request<AccountResponse>("/auth/account"),

  unlinkProvider: (provider: string) =>
    request<{ ok: boolean }>(`/auth/account/providers/${provider}`, {
      method: "DELETE",
    }),

  getTeams: () =>
    request<{
      teams: Array<{
        id: string;
        name: string;
        slug: string;
        role: string;
        meta?: TeamListingMeta;
      }>;
    }>("/teams"),

  globalSearch: (q: string, limit = 5) =>
    request<GlobalSearchResponse>(
      `/search?${new URLSearchParams({ q, limit: String(limit) })}`,
    ),

  createTeam: (data: { name: string; slug: string }) =>
    request<{ id: string; name: string; slug: string }>("/teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTeam: (teamId: string) =>
    request<{ id: string; name: string; slug: string; members: unknown[] }>(
      `/teams/${teamId}`,
    ),

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
    request<
      Project & { rules: Rule[]; entitlements: TeamEntitlementUsage | null }
    >(`/teams/${teamId}/projects/${projectId}`),

  createProject: (teamId: string, data: CreateProjectInput) =>
    request<Project>(`/teams/${teamId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProject: (
    teamId: string,
    projectId: string,
    data: UpdateProjectInput,
  ) =>
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

  discoverMail: (teamId: string, data: { email: string }) =>
    request<MailDiscoverResult>(`/teams/${teamId}/discover-mail`, {
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
    request<ConnectionTestResult>(`/teams/${teamId}/test-provider`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getGithubAppConfig: () => request<GithubAppConfig>("/github-app/config"),

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

  updateRule: (
    teamId: string,
    projectId: string,
    ruleId: string,
    data: Partial<CreateRuleInput>,
  ) =>
    request(`/teams/${teamId}/projects/${projectId}/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRule: (teamId: string, projectId: string, ruleId: string) =>
    request(`/teams/${teamId}/projects/${projectId}/rules/${ruleId}`, {
      method: "DELETE",
    }),

  getProviderOptions: (teamId: string, projectId: string) =>
    request<ProviderOptions>(
      `/teams/${teamId}/projects/${projectId}/provider-options`,
    ),

  getMailboxSnapshot: (teamId: string, projectId: string, limit = 20) =>
    request<MailboxSnapshot>(
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
    request<{ threads: Thread[] }>(
      `/teams/${teamId}/projects/${projectId}/threads`,
    ),

  getStatusEvents: (teamId: string, projectId: string) =>
    request<{ events: ProjectStatusEvent[] }>(
      `/teams/${teamId}/projects/${projectId}/status-events`,
    ),

  dismissStatusEvent: (teamId: string, projectId: string, eventId: string) =>
    request<{ ok: boolean }>(
      `/teams/${teamId}/projects/${projectId}/status-events/${eventId}/dismiss`,
      { method: "POST" },
    ),

  dismissAllStatusEvents: (teamId: string, projectId: string) =>
    request<{ ok: boolean; dismissed: number }>(
      `/teams/${teamId}/projects/${projectId}/status-events/dismiss-all`,
      { method: "POST" },
    ),

  getMessageVolume: (teamId: string, projectId: string, days: 7 | 30 | 365) =>
    request<{ days: number; points: MessageVolumePoint[] }>(
      `/teams/${teamId}/projects/${projectId}/message-volume?days=${days}`,
    ),

  getThread: (teamId: string, projectId: string, threadId: string) =>
    request<{ thread: ThreadDetail }>(
      `/teams/${teamId}/projects/${projectId}/threads/${threadId}`,
    ),

  inviteMember: (teamId: string, data: { email: string; role: string }) =>
    request<{
      member?: unknown;
      added?: boolean;
      invite?: unknown;
      invited?: boolean;
      emailSent?: boolean;
      token?: string;
    }>(`/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

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
  providerProjectLabel?: string;
  providerProjectKind?: "team" | "project";
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
  matchedRuleId: string | null;
  matchedRuleName: string | null;
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

export interface ProjectStatusEvent {
  id: string;
  projectId: string;
  category: "mail" | "provider";
  severity: "error" | "warning" | "info" | "success";
  operation: string;
  message: string;
  status: number | null;
  responseBody: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  dismissedAt: string | null;
}

export interface MessageVolumePoint {
  date: string;
  inbound: number;
  outbound: number;
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
  envelopeFromEmail?: string;
  envelopeFromName?: string | null;
  replyToEmail?: string | null;
  replyToName?: string | null;
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
    envelopeFromEmail?: string;
    envelopeFromName?: string | null;
    replyToEmail?: string | null;
    replyToName?: string | null;
    subject: string;
    bodyPreview: string;
    date: string | null;
    matched: boolean;
  }>;
  matchedCount: number;
  total: number;
}

export type AdminCheckCategory = "service" | "mail" | "git";

export interface AdminCheckResult {
  id: string;
  label: string;
  category: AdminCheckCategory;
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  error?: string;
}

export interface AdminStatusResponse {
  ok: boolean;
  checkedAt: string;
  checks: AdminCheckResult[];
}

export interface AdminAuditLogEntry {
  id: string;
  teamId: string | null;
  userId: string | null;
  projectId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  teamName: string | null;
}

export interface AdminTeamOverview {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export interface AdminProjectOverview {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  isActive: boolean;
  ruleCount: number;
  conversationCount: number;
  statusEvents: {
    error: number;
    warning: number;
    info: number;
  };
  createdAt: string;
}

export interface AdminStatusEvent extends ProjectStatusEvent {
  projectName: string;
  teamId: string;
  teamName: string;
}
