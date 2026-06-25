ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_comment_poll_at" timestamp with time zone;
