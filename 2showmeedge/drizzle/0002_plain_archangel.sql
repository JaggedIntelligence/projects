CREATE TABLE "chart_rectangle_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ticker" text NOT NULL,
	"timeframe" text DEFAULT '1d' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"top_price" numeric(24, 8) NOT NULL,
	"bottom_price" numeric(24, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_rectangle_areas_valid_time_range" CHECK ("chart_rectangle_areas"."end_time" >= "chart_rectangle_areas"."start_time"),
	CONSTRAINT "chart_rectangle_areas_valid_price_range" CHECK ("chart_rectangle_areas"."top_price" > "chart_rectangle_areas"."bottom_price"),
	CONSTRAINT "chart_rectangle_areas_positive_prices" CHECK ("chart_rectangle_areas"."top_price" > 0 AND "chart_rectangle_areas"."bottom_price" > 0)
);
--> statement-breakpoint
CREATE INDEX "chart_rectangle_areas_user_ticker_timeframe_idx" ON "chart_rectangle_areas" USING btree ("user_id","ticker","timeframe");