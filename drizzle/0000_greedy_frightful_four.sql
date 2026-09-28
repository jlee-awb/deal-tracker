CREATE TABLE "archive_deals" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_name" text NOT NULL,
	"sponsors" text,
	"bank" text,
	"ccy" text,
	"amount_mm" text,
	"premium" text,
	"day_count" text,
	"tenor_years" text,
	"insured_pct" text,
	"closing_or_drop_date" text,
	"outcome" text,
	"status_note" text,
	"covered_by" text
);
--> statement-breakpoint
CREATE TABLE "deal_details" (
	"deal_id" text PRIMARY KEY NOT NULL,
	"personal_notes" text,
	"risk_notes" text,
	"tags" text,
	"linked_emails" text,
	"priority_flag" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "deal_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"occurred_at" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"status_at_time" text,
	"source" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_name" text NOT NULL,
	"sponsors" text,
	"bank" text NOT NULL,
	"ccy" text,
	"amount_mm" text,
	"usd_eqv_mm" real,
	"premium" text,
	"day_count" text,
	"tenor_years" text,
	"insured_pct" text,
	"latest_comm_date" text,
	"status_update" text,
	"next_step" text,
	"underwriting_status" text,
	"covered_by" text,
	"status" text NOT NULL,
	"last_synced_snapshot" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_sync_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "deal_details" ADD CONSTRAINT "deal_details_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_updates" ADD CONSTRAINT "deal_updates_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sync_changes" ADD CONSTRAINT "pending_sync_changes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;