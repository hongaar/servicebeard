ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "from_address" text;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;
