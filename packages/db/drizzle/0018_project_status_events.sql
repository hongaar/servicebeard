ALTER TABLE "project_sync_errors" RENAME TO "project_status_events";
--> statement-breakpoint
ALTER TABLE "project_status_events" ADD COLUMN "severity" text NOT NULL DEFAULT 'error';
--> statement-breakpoint
ALTER INDEX "project_sync_errors_project_id_idx" RENAME TO "project_status_events_project_id_idx";
--> statement-breakpoint
ALTER INDEX "project_sync_errors_project_created_idx" RENAME TO "project_status_events_project_created_idx";
