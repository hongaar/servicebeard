CREATE TABLE "project_sync_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" text NOT NULL,
	"operation" text NOT NULL,
	"message" text NOT NULL,
	"status" integer,
	"response_body" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_sync_errors" ADD CONSTRAINT "project_sync_errors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_sync_errors_project_id_idx" ON "project_sync_errors" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "project_sync_errors_project_created_idx" ON "project_sync_errors" USING btree ("project_id","created_at");
