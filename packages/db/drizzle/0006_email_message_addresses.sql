ALTER TABLE "email_messages" ADD COLUMN "from_address" text;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL;
