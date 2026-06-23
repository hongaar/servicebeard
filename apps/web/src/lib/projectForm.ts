import type { CreateProjectInput, Project, UpdateProjectInput } from "./api";

export interface ProjectSettingsFormValues {
  name: string;
  slug: string;
  provider: string;
  providerBaseUrl: string;
  providerProjectId: string;
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
  imapPollIntervalSeconds: number;
  commentPollIntervalSeconds: number;
  webhookEnabled: boolean;
  isActive: boolean;
  inboundAckEnabled: boolean;
  inboundAckTemplate: string;
}

export const defaultProjectSettingsForm: ProjectSettingsFormValues = {
  name: "",
  slug: "",
  provider: "gitlab",
  providerBaseUrl: "https://gitlab.com",
  providerProjectId: "",
  providerToken: "",
  providerTlsInsecure: false,
  providerCaCert: "",
  imapHost: "localhost",
  imapPort: 3143,
  imapSecure: false,
  imapUser: "support",
  imapPassword: "",
  smtpHost: "localhost",
  smtpPort: 3025,
  smtpSecure: false,
  smtpUser: "support",
  smtpPassword: "",
  smtpFrom: "support@mail.test",
  imapPollIntervalSeconds: 60,
  commentPollIntervalSeconds: 120,
  webhookEnabled: true,
  isActive: true,
  inboundAckEnabled: true,
  inboundAckTemplate: `Thank you for contacting us.

We have received your email regarding "{{subject}}" and created issue #{{issueNumber}} for our team to review. We will follow up with you soon.

Reference: {{issueUrl}}`,
};

export function projectToSettingsForm(project: Project): ProjectSettingsFormValues {
  return {
    name: project.name,
    slug: project.slug,
    provider: project.provider,
    providerBaseUrl: project.providerBaseUrl,
    providerProjectId: project.providerProjectId,
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
    imapPollIntervalSeconds: project.imapPollIntervalSeconds,
    commentPollIntervalSeconds: project.commentPollIntervalSeconds,
    webhookEnabled: project.webhookEnabled,
    isActive: project.isActive,
    inboundAckEnabled: project.inboundAckEnabled,
    inboundAckTemplate: project.inboundAckTemplate,
  };
}

export function formToCreateInput(form: ProjectSettingsFormValues): CreateProjectInput {
  return {
    name: form.name,
    slug: form.slug,
    provider: form.provider,
    providerBaseUrl: form.providerBaseUrl,
    providerProjectId: form.providerProjectId,
    providerToken: form.providerToken,
    providerTlsInsecure: form.providerTlsInsecure,
    providerCaCert: form.providerCaCert.trim() || null,
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
    imapPollIntervalSeconds: form.imapPollIntervalSeconds,
    commentPollIntervalSeconds: form.commentPollIntervalSeconds,
  };
}

export function formToUpdateInput(form: ProjectSettingsFormValues): UpdateProjectInput {
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
    imapPollIntervalSeconds: form.imapPollIntervalSeconds,
    commentPollIntervalSeconds: form.commentPollIntervalSeconds,
    webhookEnabled: form.webhookEnabled,
    isActive: form.isActive,
    inboundAckEnabled: form.inboundAckEnabled,
    inboundAckTemplate: form.inboundAckTemplate,
  };

  if (form.providerToken) input.providerToken = form.providerToken;
  if (form.imapPassword) input.imapPassword = form.imapPassword;
  if (form.smtpPassword) input.smtpPassword = form.smtpPassword;
  if (form.providerCaCert.trim()) input.providerCaCert = form.providerCaCert.trim();

  return input;
}
