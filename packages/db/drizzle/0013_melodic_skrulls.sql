CREATE TYPE "public"."document_status" AS ENUM('pending-upload', 'stored');--> statement-breakpoint
CREATE TABLE "clinical_document" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"title" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer,
	"content_hash" text,
	"storage_key" text,
	"storage_provider" text DEFAULT 'unconfigured' NOT NULL,
	"status" "document_status" DEFAULT 'pending-upload' NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "clinical_document_tenant_idx" ON "clinical_document" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clinical_document_tenant_patient_idx" ON "clinical_document" USING btree ("tenant_id","patient_id");