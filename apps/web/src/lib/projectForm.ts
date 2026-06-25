import {
    detectIssueProviderFromUrl,
    GREENMAIL_DEV_PROJECT_MAIL,
    lookupMailAutoconfig,
    parseGithubRepository,
    parseGitlabProject,
    slugifyName,
    usesLocalPartMailAuth,
} from "@servicebeard/shared";
import type { CreateProjectInput, Project, UpdateProjectInput } from "./api";

export type ProviderHosting = "cloud" | "self-hosted" | "enterprise" | "dedicated";

export type GithubProviderAuthType = "pat" | "github_app";

export interface ProjectSettingsFormValues {
  name: string;
  slug: string;
  provider: string;
  providerHosting: ProviderHosting;
  providerBaseUrl: string;
  providerProjectId: string;
  providerGithubAuthType: GithubProviderAuthType;
  providerGithubInstallationId: string;
  providerToken: string;
  providerTlsInsecure: boolean;
  providerCaCert: string;
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
  isActive: boolean;
  imapMarkIngestedAsSeen: boolean;
}

export const CLOUD_PROVIDER_URLS: Record<string, string> = {
  gitlab: "https://gitlab.com",
  github: "https://github.com",
};

export function inferProviderHosting(provider: string, baseUrl: string): ProviderHosting {
  const normalized = baseUrl.replace(/\/$/, "").toLowerCase();
  const cloud = CLOUD_PROVIDER_URLS[provider]?.toLowerCase();
  if (cloud && normalized === cloud) return "cloud";
  if (provider === "github") return "enterprise";
  if (normalized.includes("dedicated")) return "dedicated";
  return "self-hosted";
}

export function cloudProviderBaseUrl(provider: string): string {
  return CLOUD_PROVIDER_URLS[provider] ?? "https://gitlab.com";
}

export function isMailServerConfigured(form: ProjectSettingsFormValues): boolean {
  return (
    form.imapHost.trim().length > 0 &&
    form.imapUser.trim().length > 0 &&
    form.imapPassword.length > 0 &&
    form.smtpHost.trim().length > 0 &&
    form.smtpUser.trim().length > 0 &&
    form.smtpPassword.length > 0
  );
}

const baseProjectSettingsForm: ProjectSettingsFormValues = {
  name: "",
  slug: "",
  provider: "",
  providerHosting: "cloud",
  providerBaseUrl: "",
  providerProjectId: "",
  providerGithubAuthType: "pat",
  providerGithubInstallationId: "",
  providerToken: "",
  providerTlsInsecure: false,
  providerCaCert: "",
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  imapUser: "",
  imapPassword: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "",
  isActive: true,
  imapMarkIngestedAsSeen: true,
};

export const defaultProjectSettingsForm: ProjectSettingsFormValues = import.meta.env.DEV
  ? { ...baseProjectSettingsForm, ...GREENMAIL_DEV_PROJECT_MAIL }
  : baseProjectSettingsForm;

export function applySupportEmailAutoconfig(
  form: ProjectSettingsFormValues,
  email: string,
): ProjectSettingsFormValues {
  const trimmed = email.trim();
  const autoconfig = lookupMailAutoconfig(trimmed);
  const mailUser = usesLocalPartMailAuth(trimmed)
    ? trimmed.slice(0, trimmed.indexOf("@"))
    : trimmed;
  const next: ProjectSettingsFormValues = {
    ...form,
    smtpFrom: trimmed,
    imapUser: mailUser,
    smtpUser: mailUser,
  };
  if (!autoconfig) return next;
  return {
    ...next,
    imapHost: autoconfig.imap.host,
    imapPort: autoconfig.imap.port,
    imapSecure: autoconfig.imap.secure,
    smtpHost: autoconfig.smtp.host,
    smtpPort: autoconfig.smtp.port,
    smtpSecure: autoconfig.smtp.secure,
  };
}

export function applyProjectName(form: ProjectSettingsFormValues, name: string): ProjectSettingsFormValues {
  return {
    ...form,
    name,
    slug: slugifyName(name),
  };
}

export function applyProviderHosting(
  form: ProjectSettingsFormValues,
  hosting: ProviderHosting,
): ProjectSettingsFormValues {
  const wasCloud = form.providerHosting === "cloud";
  let providerBaseUrl = form.providerBaseUrl;
  if (hosting === "cloud") {
    providerBaseUrl = cloudProviderBaseUrl(form.provider);
  } else if (wasCloud) {
    providerBaseUrl = "";
  }
  const next: ProjectSettingsFormValues = { ...form, providerHosting: hosting, providerBaseUrl };
  if (form.provider === "gitlab" && hosting !== "self-hosted") {
    next.providerTlsInsecure = false;
    next.providerCaCert = "";
  }
  return next;
}

export function githubProviderCredentialsReady(
  form: ProjectSettingsFormValues,
  githubAppEnabled = false,
): boolean {
  if (form.provider !== "github") return form.providerToken.length > 0;
  if (githubAppEnabled) {
    return form.providerGithubInstallationId.trim().length > 0;
  }
  return form.providerToken.length > 0;
}

export function githubAppReturnTo(
  teamId: string,
  mode: "create" | "edit",
  projectId?: string,
): string {
  if (mode === "edit" && projectId) {
    return `/teams/${teamId}/projects/${projectId}/settings`;
  }
  return `/teams/${teamId}/projects?create=1&wizardStep=provider`;
}

export function applyIssueRepositoryUrl(
  form: ProjectSettingsFormValues,
  input: string,
): ProjectSettingsFormValues {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ...form, providerProjectId: "" };
  }

  const detected = detectIssueProviderFromUrl(trimmed);
  if (detected) {
    const withProvider = applyProvider(form, detected.provider);
    return {
      ...withProvider,
      providerHosting: inferProviderHosting(detected.provider, detected.providerBaseUrl),
      providerBaseUrl: detected.providerBaseUrl,
      providerProjectId: detected.providerProjectId,
    };
  }

  if (form.provider === "github") {
    try {
      return { ...form, providerProjectId: parseGithubRepository(trimmed) };
    } catch {
      return { ...form, providerProjectId: trimmed };
    }
  }

  if (form.provider === "gitlab") {
    try {
      return { ...form, providerProjectId: parseGitlabProject(trimmed) };
    } catch {
      return { ...form, providerProjectId: trimmed };
    }
  }

  return { ...form, providerProjectId: trimmed };
}

export function normalizeProviderStepValues(
  form: ProjectSettingsFormValues,
): ProjectSettingsFormValues {
  const raw = form.providerProjectId.trim();
  if (!raw) return form;
  if (
    detectIssueProviderFromUrl(raw) ||
    raw.includes("://") ||
    /^git@/i.test(raw) ||
    /^[^/]+\.[^/]+\//.test(raw)
  ) {
    return applyIssueRepositoryUrl(form, raw);
  }
  return form;
}

export function applyProvider(
  form: ProjectSettingsFormValues,
  provider: string,
): ProjectSettingsFormValues {
  if (!provider) {
    return {
      ...form,
      provider: "",
      providerHosting: "cloud",
      providerBaseUrl: "",
      providerTlsInsecure: false,
      providerCaCert: "",
    };
  }
  return {
    ...form,
    provider,
    providerHosting: "cloud",
    providerBaseUrl: cloudProviderBaseUrl(provider),
    providerGithubAuthType: "pat",
    providerGithubInstallationId: "",
    providerTlsInsecure: false,
    providerCaCert: "",
  };
}

export function projectToSettingsForm(project: Project): ProjectSettingsFormValues {
  return {
    name: project.name,
    slug: project.slug,
    provider: project.provider,
    providerHosting: inferProviderHosting(project.provider, project.providerBaseUrl),
    providerBaseUrl: project.providerBaseUrl,
    providerProjectId: project.providerProjectId,
    providerGithubAuthType: project.providerGithubInstallationId ? "github_app" : "pat",
    providerGithubInstallationId: project.providerGithubInstallationId ?? "",
    providerToken: "",
    providerTlsInsecure: project.providerTlsInsecure,
    providerCaCert: "",
    imapHost: project.imapHost,
    imapPort: project.imapPort,
    imapSecure: project.imapSecure,
    imapUser: project.imapUser,
    imapPassword: "",
    smtpHost: project.smtpHost,
    smtpPort: project.smtpPort,
    smtpSecure: project.smtpSecure,
    smtpUser: project.smtpUser,
    smtpPassword: "",
    smtpFrom: project.smtpFrom,
    isActive: project.isActive,
    imapMarkIngestedAsSeen: project.imapMarkIngestedAsSeen,
  };
}

export function formToMailConfig(form: ProjectSettingsFormValues) {
  return {
    imapHost: form.imapHost,
    imapPort: form.imapPort,
    imapSecure: form.imapSecure,
    imapUser: form.imapUser,
    imapPassword: form.imapPassword,
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort,
    smtpSecure: form.smtpSecure,
    smtpUser: form.smtpUser,
    smtpPassword: form.smtpPassword,
    smtpFrom: form.smtpFrom,
  };
}

export function formToProviderConfig(
  form: ProjectSettingsFormValues,
  options?: { githubAppEnabled?: boolean },
) {
  const githubAppEnabled = options?.githubAppEnabled ?? false;
  const usesGithubApp =
    form.provider === "github" &&
    (githubAppEnabled || form.providerGithubInstallationId.trim().length > 0);

  return {
    provider: form.provider,
    providerBaseUrl: form.providerBaseUrl,
    providerProjectId: form.providerProjectId,
    providerGithubAuthType:
      form.provider === "github"
        ? ((usesGithubApp ? "github_app" : "pat") as GithubProviderAuthType)
        : undefined,
    providerGithubInstallationId: usesGithubApp
      ? form.providerGithubInstallationId.trim()
      : undefined,
    providerToken: usesGithubApp ? undefined : form.providerToken,
    providerTlsInsecure: form.providerTlsInsecure,
    providerCaCert: form.providerCaCert.trim() || null,
  };
}

export function formToCreateInput(
  form: ProjectSettingsFormValues,
  options?: { githubAppEnabled?: boolean },
): CreateProjectInput {
  return {
    name: form.name,
    slug: form.slug,
    ...formToProviderConfig(form, options),
    ...formToMailConfig(form),
  };
}

export function formToUpdateInput(
  form: ProjectSettingsFormValues,
  options?: { githubAppEnabled?: boolean },
): UpdateProjectInput {
  const input: UpdateProjectInput = {
    name: form.name,
    slug: form.slug,
    provider: form.provider,
    providerBaseUrl: form.providerBaseUrl,
    providerProjectId: form.providerProjectId,
    providerTlsInsecure: form.providerTlsInsecure,
    imapHost: form.imapHost,
    imapPort: form.imapPort,
    imapSecure: form.imapSecure,
    imapUser: form.imapUser,
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort,
    smtpSecure: form.smtpSecure,
    smtpUser: form.smtpUser,
    smtpFrom: form.smtpFrom,
    isActive: form.isActive,
    imapMarkIngestedAsSeen: form.imapMarkIngestedAsSeen,
  };

  if (form.providerToken) input.providerToken = form.providerToken;
  if (form.provider === "github") {
    const usesGithubApp =
      (options?.githubAppEnabled ?? false) || form.providerGithubInstallationId.trim().length > 0;
    if (usesGithubApp) {
      input.providerGithubAuthType = "github_app";
      if (form.providerGithubInstallationId.trim()) {
        input.providerGithubInstallationId = form.providerGithubInstallationId.trim();
      }
    } else {
      input.providerGithubAuthType = "pat";
    }
  }
  if (form.imapPassword) input.imapPassword = form.imapPassword;
  if (form.smtpPassword) input.smtpPassword = form.smtpPassword;
  if (form.providerCaCert.trim()) input.providerCaCert = form.providerCaCert.trim();

  return input;
}
