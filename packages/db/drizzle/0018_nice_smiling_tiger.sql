CREATE TABLE "encounter_addendum" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text NOT NULL,
	"text" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "encounter_addendum_tenant_idx" ON "encounter_addendum" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "encounter_addendum_encounter_idx" ON "encounter_addendum" USING btree ("tenant_id","encounter_id");