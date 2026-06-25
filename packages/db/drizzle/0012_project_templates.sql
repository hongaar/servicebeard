ALTER TABLE "projects" ADD COLUMN "outbound_comment_template" text DEFAULT '{{commentBody}}

---
Reply from {{authorName}} on issue #{{issueNumber}}
{{issueUrl}}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "inbound_issue_template" text DEFAULT '**Message from {{sender}}**

{{body}}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "inbound_comment_template" text DEFAULT '**Reply from {{sender}}**

{{body}}' NOT NULL;
