CREATE TYPE "public"."observation_category" AS ENUM('vital-signs', 'laboratory', 'exam', 'other');--> statement-breakpoint
CREATE TABLE "observation" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"category" "observation_category" DEFAULT 'vital-signs' NOT NULL,
	"code" text NOT NULL,
	"value_text" text NOT NULL,
	"unit" text,
	"note" text,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "observation_tenant_idx" ON "observation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "observation_tenant_patient_idx" ON "observation" USING btree ("tenant_id","patient_id");