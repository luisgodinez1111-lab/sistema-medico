CREATE TYPE "public"."appointment_status" AS ENUM('booked', 'arrived', 'fulfilled', 'cancelled', 'no-show');--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"practitioner_id" text,
	"facility_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"status" "appointment_status" DEFAULT 'booked' NOT NULL,
	"reason" text,
	"note" text,
	"arrived_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "appointment_tenant_start_idx" ON "appointment" USING btree ("tenant_id","start_at");--> statement-breakpoint
CREATE INDEX "appointment_tenant_patient_idx" ON "appointment" USING btree ("tenant_id","patient_id");