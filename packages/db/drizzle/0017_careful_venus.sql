CREATE TABLE "encounter_diagnosis" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text NOT NULL,
	"condition_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "encounter_diagnosis_tenant_idx" ON "encounter_diagnosis" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "encounter_diagnosis_unique_idx" ON "encounter_diagnosis" USING btree ("tenant_id","encounter_id","condition_id");