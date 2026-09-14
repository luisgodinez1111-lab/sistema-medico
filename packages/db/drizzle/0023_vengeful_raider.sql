CREATE TYPE "public"."task_priority" AS ENUM('routine', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('result-review', 'clinical-followup', 'arco-request', 'general');--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text,
	"type" "task_type" DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'routine' NOT NULL,
	"owner_id" text,
	"due_date" date,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_by" text,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "task_tenant_idx" ON "task" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "task_tenant_status_idx" ON "task" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "task_tenant_patient_idx" ON "task" USING btree ("tenant_id","patient_id");