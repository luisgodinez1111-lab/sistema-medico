CREATE TYPE "public"."arco_outcome" AS ENUM('granted', 'partially-granted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."arco_status" AS ENUM('received', 'in-review', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."arco_type" AS ENUM('access', 'rectification', 'cancellation', 'opposition');--> statement-breakpoint
CREATE TABLE "arco_request" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text,
	"type" "arco_type" NOT NULL,
	"status" "arco_status" DEFAULT 'received' NOT NULL,
	"requester_name" text NOT NULL,
	"requester_contact" text,
	"requester_relation" text DEFAULT 'self' NOT NULL,
	"detail" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" date NOT NULL,
	"outcome" "arco_outcome",
	"resolution" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "arco_tenant_idx" ON "arco_request" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "arco_tenant_status_idx" ON "arco_request" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "arco_tenant_patient_idx" ON "arco_request" USING btree ("tenant_id","patient_id");