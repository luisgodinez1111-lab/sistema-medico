CREATE TYPE "public"."facility_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'invited', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'read', 'update', 'delete', 'sign', 'access_denied', 'cross_tenant_denied');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('allowed', 'denied');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"status" "facility_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "membership_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_role" (
	"tenant_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"license_number" text,
	"specialty" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"relation" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"tenant_id" text NOT NULL,
	"role_id" text NOT NULL,
	"permission_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"actor_user_id" text,
	"action" "audit_action" NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"authorization_decision_id" text,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"activity" text NOT NULL,
	"agent_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_idx" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "facility_tenant_idx" ON "facility" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_tenant_user_idx" ON "membership" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_role_idx" ON "membership_role" USING btree ("membership_id","role_id");--> statement-breakpoint
CREATE INDEX "membership_role_tenant_idx" ON "membership_role" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "organization_tenant_idx" ON "organization" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "practitioner_tenant_idx" ON "practitioner" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "practitioner_tenant_user_idx" ON "practitioner" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "relationship_lookup_idx" ON "relationship" USING btree ("tenant_id","subject_type","subject_id","relation");--> statement-breakpoint
CREATE INDEX "relationship_object_idx" ON "relationship" USING btree ("tenant_id","object_type","object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_tenant_key_idx" ON "role" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permission_idx" ON "role_permission" USING btree ("role_id","permission_key");--> statement-breakpoint
CREATE INDEX "role_permission_tenant_idx" ON "role_permission" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_event_tenant_idx" ON "audit_event" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_resource_idx" ON "audit_event" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit_event" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "provenance_tenant_idx" ON "provenance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "provenance_target_idx" ON "provenance" USING btree ("target_type","target_id");