import { z } from "zod";
import { PROVIDERS, TEAM_ROLES } from "./constants";
import { stripEmptyStrings } from "./errors";
import {
  looksLikeGithubRepositoryUrl,
  parseGithubRepository,
} from "./github-repository";
import { looksLikeLinearTeamUrl, parseLinearTeam } from "./linear-team";
import { mailFromSchema } from "./mail";

function preprocessProviderProjectId(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const data = { ...(input as Record<string, unknown>) };
  if (typeof data.providerProjectId === "string") {
    const providerProjectId = data.providerProjectId;
    const shouldParseGithub =
      data.provider === "github" ||
      looksLikeGithubRepositoryUrl(providerProjectId);
    if (shouldParseGithub) {
      try {
        data.providerProjectId = parseGithubRepository(providerProjectId);
      } catch {
        // Leave raw value; refineGithubProjectId reports the error.
      }
    }

    const shouldParseLinear =
      data.provider === "linear" || looksLikeLinearTeamUrl(providerProjectId);
    if (shouldParseLinear) {
      try {
        data.providerProjectId = parseLinearTeam(providerProjectId);
      } catch {
        // Leave raw value; refineLinearTeamId reports the error.
      }
    }
  }
  return data;
}

function refineLinearTeamId(
  data: { provider?: string; providerProjectId?: string },
  ctx: z.RefinementCtx,
) {
  const projectId = data.providerProjectId;
  if (!projectId) return;

  const isLinear =
    data.provider === "linear" || looksLikeLinearTeamUrl(projectId);
  if (!isLinear) return;

  if (
    projectId.startsWith("project:") &&
    !projectId.slice("project:".length).trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Linear project reference is required",
      path: ["providerProjectId"],
    });
    return;
  }

  try {
    parseLinearTeam(projectId);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : "Invalid Linear team",
      path: ["providerProjectId"],
    });
  }
}

function refineGithubProjectId(
  data: { provider?: string; providerProjectId?: string },
  ctx: z.RefinementCtx,
) {
  const projectId = data.providerProjectId;
  if (!projectId) return;

  const isGithub =
    data.provider === "github" || looksLikeGithubRepositoryUrl(projectId);
  if (!isGithub) return;

  try {
    parseGithubRepository(projectId);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : "Invalid GitHub repository",
      path: ["providerProjectId"],
    });
  }
}

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

const providerConfigFields = z.object({
  provider: z.enum(PROVIDERS),
  providerBaseUrl: z.string().url(),
  providerProjectId: z.string().min(1),
  providerToken: z.string().optional(),
  providerGithubAuthType: z.enum(["pat", "github_app"]).optional(),
  providerGithubInstallationId: z.string().optional(),
  providerTlsInsecure: z.boolean().default(false),
  providerCaCert: z.string().nullable().optional(),
});

function refineProviderCredentials(
  data: z.infer<typeof providerConfigFields>,
  ctx: z.RefinementCtx,
) {
  if (data.provider === "github") {
    const authType =
      data.providerGithubAuthType ??
      (data.providerGithubInstallationId?.trim() ? "github_app" : "pat");
    if (authType === "github_app") {
      if (!data.providerGithubInstallationId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GitHub App installation ID is required",
          path: ["providerGithubInstallationId"],
        });
      }
      return;
    }
  }

  if (!data.providerToken?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Access token is required",
      path: ["providerToken"],
    });
  }
}

export const providerConfigSchema = z.preprocess(
  preprocessProviderProjectId,
  providerConfigFields
    .superRefine(refineGithubProjectId)
    .superRefine(refineLinearTeamId)
    .superRefine(refineProviderCredentials),
);

const createProjectFields = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const createProjectSchema = z.preprocess(
  preprocessProviderProjectId,
  createProjectFields
    .merge(providerConfigFields)
    .merge(mailConfigSchema)
    .superRefine(refineGithubProjectId)
    .superRefine(refineLinearTeamId)
    .superRefine(refineProviderCredentials),
);

export const updateProjectSchema = z.preprocess(
  (input) => preprocessProviderProjectId(stripEmptyStrings(input)),
  createProjectFields
    .partial()
    .merge(providerConfigFields.partial())
    .merge(mailConfigSchema.partial())
    .extend({
      isActive: z.boolean().optional(),
      inboundAckEnabled: z.boolean().optional(),
      inboundAckCcMailbox: z.boolean().optional(),
      inboundAckTemplate: z.string().min(1).max(10000).optional(),
      outboundCommentTemplate: z.string().min(1).max(10000).optional(),
      outboundCommentCcMailbox: z.boolean().optional(),
      inboundIssueTemplate: z.string().min(1).max(10000).optional(),
      inboundCommentTemplate: z.string().min(1).max(10000).optional(),
      imapMarkIngestedAsSeen: z.boolean().optional(),
    })
    .superRefine(refineGithubProjectId)
    .superRefine(refineLinearTeamId),
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

export const updateRuleSchema = z.preprocess(
  stripEmptyStrings,
  createRuleSchema.partial(),
);

export const testRuleSchema = z.object({
  matchSender: z.string().nullable().optional(),
  matchSubject: z.string().nullable().optional(),
  matchBody: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const discoverMailSchema = z.object({
  email: z.string().email(),
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
  inboundAckEnabled?: boolean;
  inboundAckCcMailbox?: boolean;
  inboundAckTemplate?: string;
  outboundCommentTemplate?: string;
  outboundCommentCcMailbox?: boolean;
  inboundIssueTemplate?: string;
  inboundCommentTemplate?: string;
  imapMarkIngestedAsSeen?: boolean;
}
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type TestRuleInput = z.infer<typeof testRuleSchema>;
export type DiscoverMailInput = z.infer<typeof discoverMailSchema>;
