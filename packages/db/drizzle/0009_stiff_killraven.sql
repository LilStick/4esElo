CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"discord_name" text,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ideas_author_created_idx" ON "ideas" USING btree ("discord_id","created_at");--> statement-breakpoint
CREATE INDEX "ideas_created_idx" ON "ideas" USING btree ("created_at");