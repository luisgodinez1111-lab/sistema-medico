CREATE TYPE "public"."report_abnormal_flag" AS ENUM('normal', 'low', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."report_review_status" AS ENUM('pending', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('preliminary', 'final');--> statement-breakpoint
CREATE TYPE "public"."service_request_category" AS ENUM('laboratory', 'imaging', 'procedure');--> statement-breakpoint
CREATE TYPE "public"."service_request_priority" AS ENUM('routine', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('requested', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "diagnostic_report" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"service_request_id" text,
	"code" text NOT NULL,
	"status" "report_status" DEFAULT 'final' NOT NULL,
	"value" text NOT NULL,
	"abnormal_flag" "report_abnormal_flag" DEFAULT 'normal' NOT NULL,
	"resulted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" "report_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_action" text,
	"patient_informed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_request" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"category" "service_request_category" DEFAULT 'laboratory' NOT NULL,
	"code" text NOT NULL,
	"priority" "service_request_priority" DEFAULT 'routine' NOT NULL,
	"status" "service_request_status" DEFAULT 'requested' NOT NULL,
	"note" text,
	"requested_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "diagnostic_report_tenant_idx" ON "diagnostic_report" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "diagnostic_report_tenant_patient_idx" ON "diagnostic_report" USING btree ("tenant_id","patient_id");--> statement-breakpoint
CREATE INDEX "diagnostic_report_review_idx" ON "diagnostic_report" USING btree ("tenant_id","review_status");--> statement-breakpoint
CREATE INDEX "service_request_tenant_idx" ON "service_request" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_request_tenant_patient_idx" ON "service_request" USING btree ("tenant_id","patient_id");