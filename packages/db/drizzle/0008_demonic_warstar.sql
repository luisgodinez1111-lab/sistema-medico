CREATE TYPE "public"."medication_route" AS ENUM('oral', 'iv', 'im', 'sc', 'topical', 'inhaled', 'other');--> statement-breakpoint
CREATE TYPE "public"."medication_status" AS ENUM('active', 'completed', 'stopped', 'cancelled');--> statement-breakpoint
CREATE TABLE "medication_request" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"drug" text NOT NULL,
	"dose" text,
	"route" "medication_route" DEFAULT 'oral' NOT NULL,
	"frequency" text,
	"duration_days" text,
	"instructions" text,
	"status" "medication_status" DEFAULT 'active' NOT NULL,
	"prescribed_by" text,
	"prescribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "medication_request_tenant_idx" ON "medication_request" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "medication_request_tenant_patient_idx" ON "medication_request" USING btree ("tenant_id","patient_id");