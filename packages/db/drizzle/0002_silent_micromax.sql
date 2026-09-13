CREATE TYPE "public"."allergy_category" AS ENUM('medication', 'food', 'environment', 'biologic', 'other');--> statement-breakpoint
CREATE TYPE "public"."allergy_clinical_status" AS ENUM('active', 'inactive', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."allergy_criticality" AS ENUM('low', 'high', 'unable-to-assess');--> statement-breakpoint
CREATE TABLE "allergy" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"substance" text NOT NULL,
	"category" "allergy_category" DEFAULT 'medication' NOT NULL,
	"criticality" "allergy_criticality" DEFAULT 'unable-to-assess' NOT NULL,
	"reaction" text,
	"clinical_status" "allergy_clinical_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "allergies_reviewed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "allergy_tenant_idx" ON "allergy" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "allergy_tenant_patient_idx" ON "allergy" USING btree ("tenant_id","patient_id");