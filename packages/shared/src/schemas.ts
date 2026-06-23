import { z } from "zod";
import { PROVIDERS, TEAM_ROLES } from "./constants";
import { stripEmptyStrings } from "./errors";
import { mailFromSchema } from "./mail";

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const updateTeamSchema = createTeamSchema.partial();

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(TEAM_ROLES).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(TEAM_ROLES),
});

export const mailConfigSchema = z.object({
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapSecure: z.boolean().default(true),
  imapUser: z.string().min(1),
  imapPassword: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpFrom: mailFromSchema,
});

export const providerConfigSchema = z.object({
  provider: z.enum(PROVIDERS),
  providerBaseUrl: z.string().url(),
  providerProjectId: z.string().min(1),
  providerToken: z.string().min(1),
  providerTlsInsecure: z.boolean().default(false),
  providerCaCert: z.string().nullable().optional(),
});

export const createProjectSchema = z
  .object({
    name: z.string().min(1).max(100),
    slug: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    imapPollIntervalSeconds: z.number().int().min(30).default(60),
    commentPollIntervalSeconds: z.number().int().min(30).default(120),
  })
  .merge(providerConfigSchema)
  .merge(mailConfigSchema);

export const updateProjectSchema = z.preprocess(
  stripEmptyStrings,
  createProjectSchema.partial().extend({
    isActive: z.boolean().optional(),
    webhookEnabled: z.boolean().optional(),
    inboundAckEnabled: z.boolean().optional(),
    inboundAckTemplate: z.string().min(1).max(10000).optional(),
  }),
);

export const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  matchSender: z.string().nullable().optional(),
  matchSubject: z.string().nullable().optional(),
  matchBody: z.string().nullable().optional(),
  actionCreateIssue: z.boolean().default(true),
  actionStatus: z.string().nullable().optional(),
  actionLabels: z.array(z.string()).default([]),
  actionAssigneeId: z.string().nullable().optional(),
});

export const updateRuleSchema = z.preprocess(stripEmptyStrings, createRuleSchema.partial());

export const testRuleSchema = z.object({
  matchSender: z.string().nullable().optional(),
  matchSubject: z.string().nullable().optional(),
  matchBody: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const testMailConnectionSchema = mailConfigSchema.pick({
  imapHost: true,
  imapPort: true,
  imapSecure: true,
  imapUser: true,
  imapPassword: true,
  smtpHost: true,
  smtpPort: true,
  smtpSecure: true,
  smtpUser: true,
  smtpPassword: true,
});

export const testProviderConnectionSchema = providerConfigSchema;

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  isActive?: boolean;
  webhookEnabled?: boolean;
  inboundAckEnabled?: boolean;
  inboundAckTemplate?: string;
}
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type TestRuleInput = z.infer<typeof testRuleSchema>;
