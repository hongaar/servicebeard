import type { EmailStyleConfig, EmailStylePreset } from "@servicebeard/shared";
import {
  DEFAULT_EMAIL_STYLE_CONFIG,
  DEFAULT_INBOUND_ACK_TEMPLATE,
  DEFAULT_INBOUND_COMMENT_TEMPLATE,
  DEFAULT_INBOUND_ISSUE_TEMPLATE,
  DEFAULT_OUTBOUND_COMMENT_TEMPLATE,
} from "@servicebeard/shared";
import type { Project, UpdateProjectInput } from "./api";

export interface ProjectTemplatesFormValues {
  inboundAckEnabled: boolean;
  inboundAckCcMailbox: boolean;
  inboundAckTemplate: string;
  outboundCommentTemplate: string;
  outboundCommentCcMailbox: boolean;
  inboundIssueTemplate: string;
  inboundCommentTemplate: string;
  emailStylePreset: EmailStylePreset;
  emailStyleConfig: EmailStyleConfig;
}

export const TEMPLATE_DEFAULTS = {
  inboundAckTemplate: DEFAULT_INBOUND_ACK_TEMPLATE,
  outboundCommentTemplate: DEFAULT_OUTBOUND_COMMENT_TEMPLATE,
  inboundIssueTemplate: DEFAULT_INBOUND_ISSUE_TEMPLATE,
  inboundCommentTemplate: DEFAULT_INBOUND_COMMENT_TEMPLATE,
} as const satisfies Pick<
  ProjectTemplatesFormValues,
  | "inboundAckTemplate"
  | "outboundCommentTemplate"
  | "inboundIssueTemplate"
  | "inboundCommentTemplate"
>;

export type TemplateField = keyof typeof TEMPLATE_DEFAULTS;

export const defaultProjectTemplatesForm: ProjectTemplatesFormValues = {
  inboundAckEnabled: true,
  inboundAckCcMailbox: false,
  ...TEMPLATE_DEFAULTS,
  outboundCommentCcMailbox: false,
  emailStylePreset: "none",
  emailStyleConfig: { ...DEFAULT_EMAIL_STYLE_CONFIG },
};

export function projectToTemplatesForm(
  project: Project,
  teamName?: string,
): ProjectTemplatesFormValues {
  const styleConfig = project.emailStyleConfig;
  return {
    inboundAckEnabled: project.inboundAckEnabled,
    inboundAckCcMailbox: project.inboundAckCcMailbox ?? false,
    inboundAckTemplate: project.inboundAckTemplate,
    outboundCommentTemplate:
      project.outboundCommentTemplate ?? DEFAULT_OUTBOUND_COMMENT_TEMPLATE,
    outboundCommentCcMailbox: project.outboundCommentCcMailbox ?? false,
    inboundIssueTemplate:
      project.inboundIssueTemplate ?? DEFAULT_INBOUND_ISSUE_TEMPLATE,
    inboundCommentTemplate:
      project.inboundCommentTemplate ?? DEFAULT_INBOUND_COMMENT_TEMPLATE,
    emailStylePreset: project.emailStylePreset ?? "none",
    emailStyleConfig: {
      primaryColor:
        styleConfig?.primaryColor ?? DEFAULT_EMAIL_STYLE_CONFIG.primaryColor,
      logo: styleConfig?.logo ?? null,
      showTeamName: styleConfig?.showTeamName ?? true,
      teamName: styleConfig?.teamName?.trim() || teamName || "",
      showProjectName: styleConfig?.showProjectName ?? true,
      projectName: styleConfig?.projectName?.trim() || project.name,
    },
  };
}

export function formToEmailTemplatesUpdateInput(
  form: ProjectTemplatesFormValues,
): UpdateProjectInput {
  return {
    inboundAckEnabled: form.inboundAckEnabled,
    inboundAckCcMailbox: form.inboundAckCcMailbox,
    inboundAckTemplate: form.inboundAckTemplate,
    outboundCommentTemplate: form.outboundCommentTemplate,
    outboundCommentCcMailbox: form.outboundCommentCcMailbox,
    emailStylePreset: form.emailStylePreset,
    emailStyleConfig: form.emailStyleConfig,
  };
}

export function formToIssueTrackerTemplatesUpdateInput(
  form: ProjectTemplatesFormValues,
): UpdateProjectInput {
  return {
    inboundIssueTemplate: form.inboundIssueTemplate,
    inboundCommentTemplate: form.inboundCommentTemplate,
  };
}

export function formToTemplatesUpdateInput(
  form: ProjectTemplatesFormValues,
): UpdateProjectInput {
  return {
    ...formToEmailTemplatesUpdateInput(form),
    ...formToIssueTrackerTemplatesUpdateInput(form),
  };
}
