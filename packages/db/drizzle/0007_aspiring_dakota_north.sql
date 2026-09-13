CREATE TYPE "public"."encounter_status" AS ENUM('in-progress', 'signed', 'amended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."encounter_type" AS ENUM('medicina-general', 'seguimiento', 'urgencia', 'teleconsulta');--> statement-breakpoint
CREATE TABLE "encounter" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"practitioner_id" text,
	"type" "encounter_type" DEFAULT 'medicina-general' NOT NULL,
	"status" "encounter_status" DEFAULT 'in-progress' NOT NULL,
	"reason" text,
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_by" text,
	"signed_hash" text,
	"signed_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "encounter_tenant_idx" ON "encounter" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "encounter_tenant_patient_idx" ON "encounter" USING btree ("tenant_id","patient_id");