ALTER TABLE "issue_threads" ADD COLUMN "matched_rule_id" uuid;
--> statement-breakpoint
ALTER TABLE "issue_threads" ADD CONSTRAINT "issue_threads_matched_rule_id_rules_id_fk" FOREIGN KEY ("matched_rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;
