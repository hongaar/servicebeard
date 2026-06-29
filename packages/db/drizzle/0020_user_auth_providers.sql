CREATE TABLE "user_auth_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_sub" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_providers_provider_sub_idx" ON "user_auth_providers" USING btree ("provider","external_sub");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_providers_user_provider_idx" ON "user_auth_providers" USING btree ("user_id","provider");
--> statement-breakpoint
UPDATE "users"
SET "oidc_sub" = 'local:' || substring("oidc_sub" from 5)
WHERE "oidc_sub" LIKE 'dev:%';
--> statement-breakpoint
INSERT INTO "user_auth_providers" ("user_id", "provider", "external_sub")
SELECT
	"id",
	CASE
		WHEN "oidc_sub" LIKE 'github:%' THEN 'github'
		WHEN "oidc_sub" LIKE 'gitlab:%' THEN 'gitlab'
		WHEN "oidc_sub" LIKE 'local:%' THEN 'local'
		ELSE 'oidc'
	END,
	"oidc_sub"
FROM "users"
ON CONFLICT DO NOTHING;
