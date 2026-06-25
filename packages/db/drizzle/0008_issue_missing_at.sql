ALTER TABLE "issue_threads" ADD COLUMN IF NOT EXISTS "issue_missing_at" timestamp with time zone;
