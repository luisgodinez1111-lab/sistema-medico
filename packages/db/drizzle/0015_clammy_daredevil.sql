CREATE TABLE "tenant_specialty" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"pack_version" text NOT NULL,
	"activated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
