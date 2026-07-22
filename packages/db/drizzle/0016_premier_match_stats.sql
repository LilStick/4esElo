CREATE TABLE "premier_match_stats" (
	"share_code" text NOT NULL,
	"player_id" uuid NOT NULL,
	"map" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"result" text NOT NULL,
	"rating_after" integer,
	"my_score" integer,
	"opp_score" integer,
	"stats" jsonb NOT NULL,
	CONSTRAINT "premier_match_stats_share_code_player_id_pk" PRIMARY KEY("share_code","player_id")
);
--> statement-breakpoint
ALTER TABLE "premier_match_stats" ADD CONSTRAINT "premier_match_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "premier_match_stats_player_played_idx" ON "premier_match_stats" USING btree ("player_id","played_at");--> statement-breakpoint
CREATE INDEX "premier_match_stats_played_idx" ON "premier_match_stats" USING btree ("played_at");