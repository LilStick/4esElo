ALTER TABLE "faceit_match_stats" ADD COLUMN "elo_delta" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "elo_backfill_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "elo_backfill_done_at" timestamp with time zone;