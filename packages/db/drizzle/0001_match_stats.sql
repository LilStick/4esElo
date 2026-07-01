CREATE TABLE IF NOT EXISTS "faceit_match_stats" (
	"match_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"map" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"result" integer NOT NULL,
	"elo_after" integer,
	"stats" jsonb NOT NULL,
	CONSTRAINT "faceit_match_stats_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "faceit_match_stats" ADD CONSTRAINT "faceit_match_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faceit_match_stats_player_played_idx" ON "faceit_match_stats" USING btree ("player_id","played_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faceit_match_stats_player_map_idx" ON "faceit_match_stats" USING btree ("player_id","map");