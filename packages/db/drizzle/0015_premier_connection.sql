ALTER TABLE "players" ADD COLUMN "premier_auth_code_enc" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "premier_share_code" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "premier_synced_at" timestamp with time zone;