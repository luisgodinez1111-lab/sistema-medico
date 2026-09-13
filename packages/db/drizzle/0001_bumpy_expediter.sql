CREATE TYPE "public"."patient_sex" AS ENUM('female', 'male', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'inactive', 'deceased', 'merged');--> statement-breakpoint
CREATE TABLE "patient" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"mrn" text NOT NULL,
	"curp" text,
	"given_names" text NOT NULL,
	"first_surname" text NOT NULL,
	"second_surname" text,
	"birth_date" date NOT NULL,
	"sex" "patient_sex" DEFAULT 'unknown' NOT NULL,
	"phone" text,
	"email" text,
	"dedup_key" text NOT NULL,
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"merged_into_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "patient_tenant_idx" ON "patient" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_tenant_mrn_idx" ON "patient" USING btree ("tenant_id","mrn");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_tenant_curp_idx" ON "patient" USING btree ("tenant_id","curp");--> statement-breakpoint
CREATE INDEX "patient_tenant_dedup_idx" ON "patient" USING btree ("tenant_id","dedup_key");