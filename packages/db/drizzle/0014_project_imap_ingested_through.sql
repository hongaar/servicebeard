ALTER TABLE "projects" ADD COLUMN "imap_ingested_through" timestamp with time zone;
--> statement-breakpoint
UPDATE "projects" p
SET "imap_ingested_through" = sub.max_ingested
FROM (
  SELECT "project_id", MAX("ingested_at") AS max_ingested
  FROM "project_imap_ingested_messages"
  GROUP BY "project_id"
) sub
WHERE p.id = sub.project_id;
--> statement-breakpoint
CREATE INDEX "project_imap_ingested_messages_project_ingested_at_idx" ON "project_imap_ingested_messages" USING btree ("project_id","ingested_at");
