CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."alert_condition_type" AS ENUM('above', 'below', 'crosses_above', 'crosses_below');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'triggered', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('price', 'strategy_signal', 'portfolio', 'system');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('stock', 'etf', 'crypto', 'forex', 'option');--> statement-breakpoint
CREATE TYPE "public"."backtest_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."journal_direction" AS ENUM('long', 'short', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_type" AS ENUM('idea', 'planned_trade', 'executed_trade', 'review');--> statement-breakpoint
CREATE TYPE "public"."journal_status" AS ENUM('draft', 'planned', 'open', 'closed', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."note_entity_type" AS ENUM('portfolio', 'symbol', 'strategy', 'trade_journal', 'backtest');--> statement-breakpoint
CREATE TYPE "public"."order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'filled', 'partially_filled', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('market', 'limit', 'stop', 'stop_limit');--> statement-breakpoint
CREATE TYPE "public"."portfolio_type" AS ENUM('manual', 'paper', 'live');--> statement-breakpoint
CREATE TYPE "public"."portfolio_visibility" AS ENUM('private', 'org');--> statement-breakpoint
CREATE TYPE "public"."strategy_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."strategy_type" AS ENUM('manual', 'rules_based', 'imported', 'python_later');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell', 'short', 'cover');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"user_id" text,
	"symbol_id" uuid,
	"portfolio_id" uuid,
	"strategy_id" uuid,
	"alert_type" "alert_type" NOT NULL,
	"condition_type" "alert_condition_type",
	"threshold_value" numeric(24, 8),
	"message" text NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"user_id" text,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"entry_price" numeric(24, 8) NOT NULL,
	"exit_price" numeric(24, 8),
	"entry_time" timestamp with time zone NOT NULL,
	"exit_time" timestamp with time zone,
	"pnl" numeric(24, 8),
	"pnl_percent" numeric(16, 8),
	"fees" numeric(24, 8) DEFAULT '0' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"strategy_id" uuid NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"portfolio_id" uuid,
	"name" text NOT NULL,
	"status" "backtest_status" DEFAULT 'pending' NOT NULL,
	"symbols" jsonb,
	"timeframe" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"initial_cash" numeric(24, 8) NOT NULL,
	"final_equity" numeric(24, 8),
	"total_return" numeric(16, 8),
	"max_drawdown" numeric(16, 8),
	"sharpe_ratio" numeric(16, 8),
	"win_rate" numeric(16, 8),
	"trade_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"result_summary" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"portfolio_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"average_cost" numeric(24, 8) NOT NULL,
	"cost_basis" numeric(24, 8) NOT NULL,
	"market_price" numeric(24, 8),
	"market_value" numeric(24, 8),
	"unrealized_pnl" numeric(24, 8),
	"realized_pnl" numeric(24, 8),
	"opened_at" timestamp with time zone,
	"last_price_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"entity_type" "note_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "paper_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"portfolio_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"starting_cash" numeric(24, 8) NOT NULL,
	"cash_balance" numeric(24, 8) NOT NULL,
	"buying_power" numeric(24, 8) NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_order_id" uuid NOT NULL,
	"paper_account_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"side" "order_side" NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"fill_price" numeric(24, 8) NOT NULL,
	"fees" numeric(24, 8) DEFAULT '0' NOT NULL,
	"filled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"paper_account_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"strategy_id" uuid,
	"side" "order_side" NOT NULL,
	"order_type" "order_type" NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"limit_price" numeric(24, 8),
	"stop_price" numeric(24, 8),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"rejected_reason" text,
	"client_order_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"paper_account_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"average_price" numeric(24, 8) NOT NULL,
	"cost_basis" numeric(24, 8) NOT NULL,
	"market_price" numeric(24, 8),
	"market_value" numeric(24, 8),
	"unrealized_pnl" numeric(24, 8),
	"realized_pnl" numeric(24, 8),
	"opened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"portfolio_type" "portfolio_type" DEFAULT 'manual' NOT NULL,
	"visibility" "portfolio_visibility" DEFAULT 'private' NOT NULL,
	"starting_cash" numeric(24, 8) DEFAULT '0' NOT NULL,
	"current_cash" numeric(24, 8) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"strategy_type" "strategy_type" DEFAULT 'manual' NOT NULL,
	"status" "strategy_status" DEFAULT 'draft' NOT NULL,
	"default_symbol_id" uuid,
	"timeframe" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb,
	"entry_rules" jsonb,
	"exit_rules" jsonb,
	"risk_rules" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"exchange" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"country" text,
	"sector" text,
	"industry" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"portfolio_id" uuid,
	"symbol_id" uuid,
	"strategy_id" uuid,
	"title" text NOT NULL,
	"entry_type" "journal_entry_type" DEFAULT 'idea' NOT NULL,
	"direction" "journal_direction" DEFAULT 'neutral' NOT NULL,
	"status" "journal_status" DEFAULT 'draft' NOT NULL,
	"entry_price" numeric(24, 8),
	"exit_price" numeric(24, 8),
	"quantity" numeric(24, 8),
	"thesis" text,
	"risk_notes" text,
	"outcome_notes" text,
	"tags" jsonb,
	"trade_date" date,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "watchlist_symbols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"symbol_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"alert_enabled" boolean DEFAULT false NOT NULL,
	"added_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_accounts" ADD CONSTRAINT "paper_accounts_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_fills" ADD CONSTRAINT "paper_fills_paper_order_id_paper_orders_id_fk" FOREIGN KEY ("paper_order_id") REFERENCES "public"."paper_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_fills" ADD CONSTRAINT "paper_fills_paper_account_id_paper_accounts_id_fk" FOREIGN KEY ("paper_account_id") REFERENCES "public"."paper_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_fills" ADD CONSTRAINT "paper_fills_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_paper_account_id_paper_accounts_id_fk" FOREIGN KEY ("paper_account_id") REFERENCES "public"."paper_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_positions" ADD CONSTRAINT "paper_positions_paper_account_id_paper_accounts_id_fk" FOREIGN KEY ("paper_account_id") REFERENCES "public"."paper_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_positions" ADD CONSTRAINT "paper_positions_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_default_symbol_id_symbols_id_fk" FOREIGN KEY ("default_symbol_id") REFERENCES "public"."symbols"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_journal_entries" ADD CONSTRAINT "trade_journal_entries_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_journal_entries" ADD CONSTRAINT "trade_journal_entries_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_journal_entries" ADD CONSTRAINT "trade_journal_entries_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_symbols" ADD CONSTRAINT "watchlist_symbols_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_symbols" ADD CONSTRAINT "watchlist_symbols_symbol_id_symbols_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_priority_idx" ON "tasks" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "alerts_organization_id_idx" ON "alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "alerts_user_id_idx" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alerts_symbol_id_idx" ON "alerts" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "alerts_portfolio_id_idx" ON "alerts" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "alerts_strategy_id_idx" ON "alerts" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_events_user_id_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_idx" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "backtest_trades_backtest_id_idx" ON "backtest_trades" USING btree ("backtest_id");--> statement-breakpoint
CREATE INDEX "backtest_trades_symbol_id_idx" ON "backtest_trades" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "backtests_organization_id_idx" ON "backtests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "backtests_strategy_id_idx" ON "backtests" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "backtests_strategy_version_id_idx" ON "backtests" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE INDEX "backtests_created_by_user_id_idx" ON "backtests" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "holdings_portfolio_id_idx" ON "holdings" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "holdings_symbol_id_idx" ON "holdings" USING btree ("symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_portfolio_symbol_unique" ON "holdings" USING btree ("portfolio_id","symbol_id");--> statement-breakpoint
CREATE INDEX "notes_organization_id_idx" ON "notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notes_created_by_user_id_idx" ON "notes" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "paper_accounts_organization_id_idx" ON "paper_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "paper_accounts_portfolio_id_idx" ON "paper_accounts" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "paper_accounts_created_by_user_id_idx" ON "paper_accounts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "paper_fills_paper_order_id_idx" ON "paper_fills" USING btree ("paper_order_id");--> statement-breakpoint
CREATE INDEX "paper_fills_paper_account_id_idx" ON "paper_fills" USING btree ("paper_account_id");--> statement-breakpoint
CREATE INDEX "paper_fills_symbol_id_idx" ON "paper_fills" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "paper_orders_organization_id_idx" ON "paper_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "paper_orders_paper_account_id_idx" ON "paper_orders" USING btree ("paper_account_id");--> statement-breakpoint
CREATE INDEX "paper_orders_portfolio_id_idx" ON "paper_orders" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "paper_orders_symbol_id_idx" ON "paper_orders" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "paper_orders_strategy_id_idx" ON "paper_orders" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_orders_client_order_id_unique" ON "paper_orders" USING btree ("client_order_id");--> statement-breakpoint
CREATE INDEX "paper_positions_organization_id_idx" ON "paper_positions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "paper_positions_paper_account_id_idx" ON "paper_positions" USING btree ("paper_account_id");--> statement-breakpoint
CREATE INDEX "paper_positions_symbol_id_idx" ON "paper_positions" USING btree ("symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_positions_account_symbol_unique" ON "paper_positions" USING btree ("paper_account_id","symbol_id");--> statement-breakpoint
CREATE INDEX "portfolios_organization_id_idx" ON "portfolios" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "portfolios_created_by_user_id_idx" ON "portfolios" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "strategies_organization_id_idx" ON "strategies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategies_created_by_user_id_idx" ON "strategies" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "strategies_default_symbol_id_idx" ON "strategies" USING btree ("default_symbol_id");--> statement-breakpoint
CREATE INDEX "strategy_versions_strategy_id_idx" ON "strategy_versions" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_versions_strategy_version_unique" ON "strategy_versions" USING btree ("strategy_id","version_number");--> statement-breakpoint
CREATE INDEX "symbols_ticker_idx" ON "symbols" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "symbols_ticker_exchange_asset_type_unique" ON "symbols" USING btree ("ticker","exchange","asset_type");--> statement-breakpoint
CREATE INDEX "trade_journal_entries_organization_id_idx" ON "trade_journal_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_journal_entries_portfolio_id_idx" ON "trade_journal_entries" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "trade_journal_entries_symbol_id_idx" ON "trade_journal_entries" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "trade_journal_entries_strategy_id_idx" ON "trade_journal_entries" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "trade_journal_entries_created_by_user_id_idx" ON "trade_journal_entries" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "watchlist_symbols_watchlist_id_idx" ON "watchlist_symbols" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlist_symbols_symbol_id_idx" ON "watchlist_symbols" USING btree ("symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_symbols_watchlist_symbol_unique" ON "watchlist_symbols" USING btree ("watchlist_id","symbol_id");--> statement-breakpoint
CREATE INDEX "watchlists_organization_id_idx" ON "watchlists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "watchlists_created_by_user_id_idx" ON "watchlists" USING btree ("created_by_user_id");