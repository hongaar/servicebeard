ALTER TABLE "projects" ADD COLUMN "email_style_preset" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "email_style_config" jsonb;
