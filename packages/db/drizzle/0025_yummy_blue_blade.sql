CREATE TABLE "webauthn_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text,
	"name" text,
	"device_type" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "current_webauthn_challenge" text;--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credential_id_idx" ON "webauthn_credential" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_credential_user_idx" ON "webauthn_credential" USING btree ("user_id");