ALTER TABLE "projects" ADD COLUMN "provider_tls_insecure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "provider_ca_cert_encrypted" text;