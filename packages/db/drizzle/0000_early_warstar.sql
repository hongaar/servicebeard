CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"user_id" uuid,
	"project_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"message_id" text NOT NULL,
	"in_reply_to" text,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"external_note_id" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"external_issue_id" text NOT NULL,
	"issue_iid" integer NOT NULL,
	"issue_url" text NOT NULL,
	"original_sender_email" text NOT NULL,
	"original_sender_name" text,
	"subject_normalized" text NOT NULL,
	"last_seen_note_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"project_id" uuid,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"provider" text DEFAULT 'gitlab' NOT NULL,
	"provider_base_url" text NOT NULL,
	"provider_project_id" text NOT NULL,
	"provider_token_encrypted" text NOT NULL,
	"provider_bot_user_id" text,
	"imap_host" text NOT NULL,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"imap_secure" boolean DEFAULT true NOT NULL,
	"imap_user" text NOT NULL,
	"imap_password_encrypted" text NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_password_encrypted" text NOT NULL,
	"smtp_from" text NOT NULL,
	"webhook_secret" text NOT NULL,
	"webhook_enabled" boolean DEFAULT true NOT NULL,
	"imap_poll_interval_seconds" integer DEFAULT 60 NOT NULL,
	"comment_poll_interval_seconds" integer DEFAULT 120 NOT NULL,
	"last_imap_poll_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"match_sender" text,
	"match_subject" text,
	"match_body" text,
	"action_create_issue" boolean DEFAULT true NOT NULL,
	"action_status" text,
	"action_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action_assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"oidc_sub" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_issue_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."issue_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_threads" ADD CONSTRAINT "issue_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_team_id_idx" ON "audit_log" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_message_id_idx" ON "email_messages" USING btree ("project_id","message_id");--> statement-breakpoint
CREATE INDEX "email_messages_thread_id_idx" ON "email_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_external_note_id_idx" ON "email_messages" USING btree ("project_id","external_note_id");--> statement-breakpoint
CREATE INDEX "issue_threads_project_id_idx" ON "issue_threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_threads_external_issue_id_idx" ON "issue_threads" USING btree ("external_issue_id");--> statement-breakpoint
CREATE INDEX "issue_threads_subject_normalized_idx" ON "issue_threads" USING btree ("project_id","subject_normalized");--> statement-breakpoint
CREATE INDEX "job_runs_job_type_idx" ON "job_runs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "job_runs_project_id_idx" ON "job_runs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_team_slug_idx" ON "projects" USING btree ("team_id","slug");--> statement-breakpoint
CREATE INDEX "projects_team_id_idx" ON "projects" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "rules_project_id_idx" ON "rules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invites_team_email_idx" ON "team_invites" USING btree ("team_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_idx" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");