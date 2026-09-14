CREATE TYPE "public"."consent_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('privacy-notice', 'treatment', 'data-sharing', 'informed-procedure');--> statement-breakpoint
CREATE TABLE "consent" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"type" "consent_type" NOT NULL,
	"status" "consent_status" DEFAULT 'active' NOT NULL,
	"policy_version" text,
	"note" text,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "consent_tenant_idx" ON "consent" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_tenant_patient_idx" ON "consent" USING btree ("tenant_id","patient_id");