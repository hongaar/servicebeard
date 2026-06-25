ALTER TABLE "projects" ADD COLUMN "imap_mark_ingested_as_seen" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE "project_imap_ingested_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_imap_ingested_messages" ADD CONSTRAINT "project_imap_ingested_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_imap_ingested_messages_project_message_idx" ON "project_imap_ingested_messages" USING btree ("project_id","message_id");
--> statement-breakpoint
CREATE INDEX "project_imap_ingested_messages_project_id_idx" ON "project_imap_ingested_messages" USING btree ("project_id");
--> statement-breakpoint
INSERT INTO "project_imap_ingested_messages" ("project_id", "message_id")
SELECT DISTINCT "project_id", "message_id" FROM "email_messages"
ON CONFLICT ("project_id", "message_id") DO NOTHING;
