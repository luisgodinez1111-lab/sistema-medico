CREATE TABLE "encounter_exam_finding" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text NOT NULL,
	"section" text NOT NULL,
	"normal" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exam_finding_tenant_idx" ON "encounter_exam_finding" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_finding_encounter_section_idx" ON "encounter_exam_finding" USING btree ("tenant_id","encounter_id","section");