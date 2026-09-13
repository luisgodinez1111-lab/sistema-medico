CREATE TYPE "public"."condition_clinical_status" AS ENUM('active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved');--> statement-breakpoint
CREATE TABLE "condition" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"code" text NOT NULL,
	"code_system" text,
	"clinical_status" "condition_clinical_status" DEFAULT 'active' NOT NULL,
	"onset_date" date,
	"note" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "condition_tenant_idx" ON "condition" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "condition_tenant_patient_idx" ON "condition" USING btree ("tenant_id","patient_id");