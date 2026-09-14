CREATE TYPE "public"."procedure_status" AS ENUM('in-progress', 'completed', 'not-done', 'entered-in-error');--> statement-breakpoint
CREATE TABLE "procedure" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"service_request_id" text,
	"code" text NOT NULL,
	"status" "procedure_status" DEFAULT 'completed' NOT NULL,
	"performed_date" date,
	"performer_id" text,
	"outcome" text,
	"note" text,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "procedure_tenant_idx" ON "procedure" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "procedure_tenant_patient_idx" ON "procedure" USING btree ("tenant_id","patient_id");--> statement-breakpoint
CREATE INDEX "procedure_tenant_encounter_idx" ON "procedure" USING btree ("tenant_id","encounter_id");