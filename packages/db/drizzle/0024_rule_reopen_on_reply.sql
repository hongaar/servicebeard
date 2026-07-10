ALTER TABLE "rules" ADD COLUMN "action_reopen_on_reply" boolean DEFAULT true NOT NULL;
ALTER TABLE "projects" DROP COLUMN IF EXISTS "inbound_reopen_on_reply";
