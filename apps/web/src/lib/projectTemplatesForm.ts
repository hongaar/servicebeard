import {
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
};

export function projectToTemplatesForm(project: Project): ProjectTemplatesFormValues {
  return {
    inboundAckEnabled: project.inboundAckEnabled,
    inboundAckCcMailbox: project.inboundAckCcMailbox ?? false,
    inboundAckTemplate: project.inboundAckTemplate,
    outboundCommentTemplate:
      project.outboundCommentTemplate ?? DEFAULT_OUTBOUND_COMMENT_TEMPLATE,
    outboundCommentCcMailbox: project.outboundCommentCcMailbox ?? false,
    inboundIssueTemplate: project.inboundIssueTemplate ?? DEFAULT_INBOUND_ISSUE_TEMPLATE,
    inboundCommentTemplate:
      project.inboundCommentTemplate ?? DEFAULT_INBOUND_COMMENT_TEMPLATE,
  };
}

export function formToTemplatesUpdateInput(
  form: ProjectTemplatesFormValues,
): UpdateProjectInput {
  return {
    inboundAckEnabled: form.inboundAckEnabled,
    inboundAckCcMailbox: form.inboundAckCcMailbox,
    inboundAckTemplate: form.inboundAckTemplate,
    outboundCommentTemplate: form.outboundCommentTemplate,
    outboundCommentCcMailbox: form.outboundCommentCcMailbox,
    inboundIssueTemplate: form.inboundIssueTemplate,
    inboundCommentTemplate: form.inboundCommentTemplate,
  };
}
