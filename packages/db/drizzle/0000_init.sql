CREATE TYPE "public"."elo_source" AS ENUM('faceit', 'premier');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "elo_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"source" "elo_source" NOT NULL,
	"elo" integer NOT NULL,
	"level" integer,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faceit_matches" (
	"match_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"elo_after" integer,
	"result" integer,
	"kills" integer,
	"deaths" integer,
	"assists" integer,
	"adr" integer,
	"map" text,
	"played_at" timestamp with time zone NOT NULL,
	CONSTRAINT "faceit_matches_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text,
	"discord_name" text,
	"faceit_id" text,
	"faceit_nickname" text,
	"steam_id64" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_discord_id_unique" UNIQUE("discord_id"),
	CONSTRAINT "players_faceit_id_unique" UNIQUE("faceit_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "faceit_matches" ADD CONSTRAINT "faceit_matches_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "elo_snapshots_player_source_idx" ON "elo_snapshots" USING btree ("player_id","source","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faceit_matches_player_idx" ON "faceit_matches" USING btree ("player_id","played_at");