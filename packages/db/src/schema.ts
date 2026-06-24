import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  oidcSub: text("oidc_sub").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type"),
    backedUp: boolean("backed_up").notNull().default(false),
    transports: jsonb("transports").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webauthn_credentials_user_id_idx").on(table.userId)],
);

export const webauthnChallenges = pgTable(
  "webauthn_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challenge: text("challenge").notNull().unique(),
    type: text("type").notNull(),
    email: text("email"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webauthn_challenges_expires_at_idx").on(table.expiresAt)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("teams_slug_idx").on(table.slug)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_team_user_idx").on(table.teamId, table.userId),
    index("team_members_user_id_idx").on(table.userId),
  ],
);

export const teamInvites = pgTable(
  "team_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_invites_team_email_idx").on(table.teamId, table.email),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    provider: text("provider").notNull().default("gitlab"),
    providerBaseUrl: text("provider_base_url").notNull(),
    providerProjectId: text("provider_project_id").notNull(),
    providerTokenEncrypted: text("provider_token_encrypted").notNull(),
    providerBotUserId: text("provider_bot_user_id"),
    providerTlsInsecure: boolean("provider_tls_insecure").notNull().default(false),
    providerCaCertEncrypted: text("provider_ca_cert_encrypted"),
    imapHost: text("imap_host").notNull(),
    imapPort: integer("imap_port").notNull().default(993),
    imapSecure: boolean("imap_secure").notNull().default(true),
    imapUser: text("imap_user").notNull(),
    imapPasswordEncrypted: text("imap_password_encrypted").notNull(),
    smtpHost: text("smtp_host").notNull(),
    smtpPort: integer("smtp_port").notNull().default(587),
    smtpSecure: boolean("smtp_secure").notNull().default(false),
    smtpUser: text("smtp_user").notNull(),
    smtpPasswordEncrypted: text("smtp_password_encrypted").notNull(),
    smtpFrom: text("smtp_from").notNull(),
    webhookSecret: text("webhook_secret").notNull(),
    webhookEnabled: boolean("webhook_enabled").notNull().default(true),
    imapPollIntervalSeconds: integer("imap_poll_interval_seconds").notNull().default(60),
    commentPollIntervalSeconds: integer("comment_poll_interval_seconds").notNull().default(120),
    inboundAckEnabled: boolean("inbound_ack_enabled").notNull().default(true),
    inboundAckTemplate: text("inbound_ack_template").notNull().default(
      `Thank you for contacting us.

We have received your email regarding "{{subject}}" and created issue #{{issueNumber}} for our team to review. We will follow up with you soon.

Reference: {{issueUrl}}`,
    ),
    lastImapPollAt: timestamp("last_imap_poll_at", { withTimezone: true }),
    lastCommentPollAt: timestamp("last_comment_poll_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_team_slug_idx").on(table.teamId, table.slug),
    index("projects_team_id_idx").on(table.teamId),
  ],
);

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: integer("priority").notNull().default(0),
    isEnabled: boolean("is_enabled").notNull().default(true),
    matchSender: text("match_sender"),
    matchSubject: text("match_subject"),
    matchBody: text("match_body"),
    actionCreateIssue: boolean("action_create_issue").notNull().default(true),
    actionStatus: text("action_status"),
    actionLabels: jsonb("action_labels").$type<string[]>().notNull().default([]),
    actionAssigneeId: text("action_assignee_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rules_project_id_idx").on(table.projectId)],
);

export const issueThreads = pgTable(
  "issue_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalIssueId: text("external_issue_id").notNull(),
    issueIid: integer("issue_iid").notNull(),
    issueUrl: text("issue_url").notNull(),
    originalSenderEmail: text("original_sender_email").notNull(),
    originalSenderName: text("original_sender_name"),
    subjectNormalized: text("subject_normalized").notNull(),
    lastSeenNoteAt: timestamp("last_seen_note_at", { withTimezone: true }),
    issueMissingAt: timestamp("issue_missing_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("issue_threads_project_id_idx").on(table.projectId),
    index("issue_threads_external_issue_id_idx").on(table.externalIssueId),
    index("issue_threads_subject_normalized_idx").on(table.projectId, table.subjectNormalized),
  ],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => issueThreads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    messageId: text("message_id").notNull(),
    inReplyTo: text("in_reply_to"),
    references: jsonb("references").$type<string[]>().notNull().default([]),
    subject: text("subject"),
    bodyText: text("body_text"),
    fromAddress: text("from_address"),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull().default([]),
    ccAddresses: jsonb("cc_addresses").$type<string[]>().notNull().default([]),
    bccAddresses: jsonb("bcc_addresses").$type<string[]>().notNull().default([]),
    externalNoteId: text("external_note_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_messages_message_id_idx").on(table.projectId, table.messageId),
    index("email_messages_thread_id_idx").on(table.threadId),
    uniqueIndex("email_messages_external_note_id_idx").on(
      table.projectId,
      table.externalNoteId,
    ),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_team_id_idx").on(table.teamId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobType: text("job_type").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("job_runs_job_type_idx").on(table.jobType),
    index("job_runs_project_id_idx").on(table.projectId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  teamMembers: many(teamMembers),
  webauthnCredentials: many(webauthnCredentials),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const webauthnCredentialsRelations = relations(webauthnCredentials, ({ one }) => ({
  user: one(users, { fields: [webauthnCredentials.userId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  projects: many(projects),
  invites: many(teamInvites),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  team: one(teams, { fields: [teamInvites.teamId], references: [teams.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, { fields: [projects.teamId], references: [teams.id] }),
  rules: many(rules),
  threads: many(issueThreads),
}));

export const rulesRelations = relations(rules, ({ one }) => ({
  project: one(projects, { fields: [rules.projectId], references: [projects.id] }),
}));

export const issueThreadsRelations = relations(issueThreads, ({ one, many }) => ({
  project: one(projects, { fields: [issueThreads.projectId], references: [projects.id] }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  thread: one(issueThreads, {
    fields: [emailMessages.threadId],
    references: [issueThreads.id],
  }),
  project: one(projects, {
    fields: [emailMessages.projectId],
    references: [projects.id],
  }),
}));
