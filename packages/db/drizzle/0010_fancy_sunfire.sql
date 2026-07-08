CREATE TABLE "banned_discord_ids" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"banned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
