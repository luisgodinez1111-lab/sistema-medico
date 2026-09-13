ALTER TABLE "audit_event" ADD COLUMN "patient_id" text;--> statement-breakpoint
CREATE INDEX "audit_event_patient_idx" ON "audit_event" USING btree ("tenant_id","patient_id");