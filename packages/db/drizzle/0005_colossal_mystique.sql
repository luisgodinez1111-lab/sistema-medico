CREATE TYPE "public"."related_person_relationship" AS ENUM('mother', 'father', 'guardian', 'spouse', 'sibling', 'child', 'caregiver', 'emergency-contact', 'other');--> statement-breakpoint
CREATE TABLE "related_person" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"relationship" "related_person_relationship" DEFAULT 'other' NOT NULL,
	"phone" text,
	"email" text,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"note" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "related_person_tenant_idx" ON "related_person" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "related_person_tenant_patient_idx" ON "related_person" USING btree ("tenant_id","patient_id");