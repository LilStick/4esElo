CREATE TABLE "matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"map" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"winner_team_id" text,
	"teams" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "matches_played_idx" ON "matches" USING btree ("played_at");