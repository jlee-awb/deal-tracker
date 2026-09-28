ALTER TABLE "pending_sync_changes" ALTER COLUMN "field" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_sync_changes" ADD COLUMN "kind" text DEFAULT 'outbound' NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_sync_changes" ADD COLUMN "sheet_value" text;--> statement-breakpoint
ALTER TABLE "pending_sync_changes" ADD COLUMN "resolution" text;