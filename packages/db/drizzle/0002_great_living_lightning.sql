ALTER TABLE "projects" ADD COLUMN "inbound_ack_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "inbound_ack_template" text DEFAULT 'Thank you for contacting us.

We have received your email regarding "{{subject}}" and created issue #{{issueNumber}} for our team to review. We will follow up with you soon.

Reference: {{issueUrl}}' NOT NULL;