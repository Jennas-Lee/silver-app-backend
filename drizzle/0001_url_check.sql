CREATE TABLE "url_records" (
	"id" text NOT NULL,
	"senior_id" uuid NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"host" text NOT NULL,
	"url_masked" text NOT NULL,
	"app" text NOT NULL,
	"action" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "url_records_senior_id_id_pk" PRIMARY KEY("senior_id","id")
);
--> statement-breakpoint
CREATE TABLE "url_verdicts" (
	"key" text PRIMARY KEY NOT NULL,
	"verdict" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "url_records" ADD CONSTRAINT "url_records_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "url_records_senior_visited_idx" ON "url_records" USING btree ("senior_id","visited_at");