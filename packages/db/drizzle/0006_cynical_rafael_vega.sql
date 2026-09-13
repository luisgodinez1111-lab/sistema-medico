CREATE TABLE "history_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"section" text NOT NULL,
	"code" text NOT NULL,
	"value" text NOT NULL,
	"note" text,
	"schema_version" text NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "history_entry_tenant_idx" ON "history_entry" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "history_entry_tenant_patient_idx" ON "history_entry" USING btree ("tenant_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "history_entry_patient_item_idx" ON "history_entry" USING btree ("tenant_id","patient_id","section","code");