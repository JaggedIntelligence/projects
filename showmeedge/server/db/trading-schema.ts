import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const assetType = pgEnum("asset_type", ["stock", "etf", "crypto", "forex", "option"]);
export const portfolioType = pgEnum("portfolio_type", ["manual", "paper", "live"]);
export const portfolioVisibility = pgEnum("portfolio_visibility", ["private", "org"]);
export const strategyType = pgEnum("strategy_type", ["manual", "rules_based", "imported", "python_later"]);
export const strategyStatus = pgEnum("strategy_status", ["draft", "active", "archived"]);
export const backtestStatus = pgEnum("backtest_status", ["pending", "running", "completed", "failed"]);
export const tradeSide = pgEnum("trade_side", ["buy", "sell", "short", "cover"]);
export const journalEntryType = pgEnum("journal_entry_type", ["idea", "planned_trade", "executed_trade", "review"]);
export const journalDirection = pgEnum("journal_direction", ["long", "short", "neutral"]);
export const journalStatus = pgEnum("journal_status", ["draft", "planned", "open", "closed", "reviewed"]);
export const accountStatus = pgEnum("account_status", ["active", "paused", "archived"]);
export const orderSide = pgEnum("order_side", ["buy", "sell"]);
export const orderType = pgEnum("order_type", ["market", "limit", "stop", "stop_limit"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "filled",
  "partially_filled",
  "cancelled",
  "rejected"
]);
export const alertType = pgEnum("alert_type", ["price", "strategy_signal", "portfolio", "system"]);
export const alertConditionType = pgEnum("alert_condition_type", [
  "above",
  "below",
  "crosses_above",
  "crosses_below"
]);
export const alertStatus = pgEnum("alert_status", ["active", "triggered", "paused", "archived"]);
export const noteEntityType = pgEnum("note_entity_type", [
  "portfolio",
  "symbol",
  "strategy",
  "trade_journal",
  "backtest"
]);

const money = (name: string) => numeric(name, { precision: 24, scale: 8 });
const ratio = (name: string) => numeric(name, { precision: 16, scale: 8 });

export const symbols = pgTable(
  "symbols",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    assetType: assetType("asset_type").notNull(),
    exchange: text("exchange").notNull(),
    currency: text("currency").notNull().default("USD"),
    country: text("country"),
    sector: text("sector"),
    industry: text("industry"),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    tickerIdx: index("symbols_ticker_idx").on(table.ticker),
    lookupUnique: uniqueIndex("symbols_ticker_exchange_asset_type_unique").on(
      table.ticker,
      table.exchange,
      table.assetType
    )
  })
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    description: text("description"),
    baseCurrency: text("base_currency").notNull().default("USD"),
    portfolioType: portfolioType("portfolio_type").notNull().default("manual"),
    visibility: portfolioVisibility("visibility").notNull().default("private"),
    startingCash: money("starting_cash").notNull().default("0"),
    currentCash: money("current_cash").notNull().default("0"),
    isDefault: boolean("is_default").notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    organizationIdx: index("portfolios_organization_id_idx").on(table.organizationId),
    createdByUserIdx: index("portfolios_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    quantity: money("quantity").notNull(),
    averageCost: money("average_cost").notNull(),
    costBasis: money("cost_basis").notNull(),
    marketPrice: money("market_price"),
    marketValue: money("market_value"),
    unrealizedPnl: money("unrealized_pnl"),
    realizedPnl: money("realized_pnl"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    lastPriceAt: timestamp("last_price_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    portfolioIdx: index("holdings_portfolio_id_idx").on(table.portfolioId),
    symbolIdx: index("holdings_symbol_id_idx").on(table.symbolId),
    portfolioSymbolUnique: uniqueIndex("holdings_portfolio_symbol_unique").on(table.portfolioId, table.symbolId)
  })
);

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    organizationIdx: index("watchlists_organization_id_idx").on(table.organizationId),
    createdByUserIdx: index("watchlists_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const watchlistSymbols = pgTable(
  "watchlist_symbols",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    alertEnabled: boolean("alert_enabled").notNull().default(false),
    addedByUserId: text("added_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    watchlistIdx: index("watchlist_symbols_watchlist_id_idx").on(table.watchlistId),
    symbolIdx: index("watchlist_symbols_symbol_id_idx").on(table.symbolId),
    watchlistSymbolUnique: uniqueIndex("watchlist_symbols_watchlist_symbol_unique").on(
      table.watchlistId,
      table.symbolId
    )
  })
);

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    description: text("description"),
    strategyType: strategyType("strategy_type").notNull().default("manual"),
    status: strategyStatus("status").notNull().default("draft"),
    defaultSymbolId: uuid("default_symbol_id").references(() => symbols.id, { onDelete: "set null" }),
    timeframe: text("timeframe"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    organizationIdx: index("strategies_organization_id_idx").on(table.organizationId),
    createdByUserIdx: index("strategies_created_by_user_id_idx").on(table.createdByUserId),
    defaultSymbolIdx: index("strategies_default_symbol_id_idx").on(table.defaultSymbolId)
  })
);

export const strategyVersions = pgTable(
  "strategy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    entryRules: jsonb("entry_rules").$type<Record<string, unknown>>(),
    exitRules: jsonb("exit_rules").$type<Record<string, unknown>>(),
    riskRules: jsonb("risk_rules").$type<Record<string, unknown>>(),
    isActive: boolean("is_active").notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    strategyIdx: index("strategy_versions_strategy_id_idx").on(table.strategyId),
    strategyVersionUnique: uniqueIndex("strategy_versions_strategy_version_unique").on(
      table.strategyId,
      table.versionNumber
    )
  })
);

export const backtests = pgTable(
  "backtests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    strategyVersionId: uuid("strategy_version_id")
      .notNull()
      .references(() => strategyVersions.id, { onDelete: "restrict" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: backtestStatus("status").notNull().default("pending"),
    symbols: jsonb("symbols").$type<string[]>(),
    timeframe: text("timeframe").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    initialCash: money("initial_cash").notNull(),
    finalEquity: money("final_equity"),
    totalReturn: ratio("total_return"),
    maxDrawdown: ratio("max_drawdown"),
    sharpeRatio: ratio("sharpe_ratio"),
    winRate: ratio("win_rate"),
    tradeCount: integer("trade_count").notNull().default(0),
    errorMessage: text("error_message"),
    resultSummary: jsonb("result_summary").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    organizationIdx: index("backtests_organization_id_idx").on(table.organizationId),
    strategyIdx: index("backtests_strategy_id_idx").on(table.strategyId),
    strategyVersionIdx: index("backtests_strategy_version_id_idx").on(table.strategyVersionId),
    createdByUserIdx: index("backtests_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const backtestTrades = pgTable(
  "backtest_trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backtestId: uuid("backtest_id")
      .notNull()
      .references(() => backtests.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    side: tradeSide("side").notNull(),
    quantity: money("quantity").notNull(),
    entryPrice: money("entry_price").notNull(),
    exitPrice: money("exit_price"),
    entryTime: timestamp("entry_time", { withTimezone: true }).notNull(),
    exitTime: timestamp("exit_time", { withTimezone: true }),
    pnl: money("pnl"),
    pnlPercent: ratio("pnl_percent"),
    fees: money("fees").notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    backtestIdx: index("backtest_trades_backtest_id_idx").on(table.backtestId),
    symbolIdx: index("backtest_trades_symbol_id_idx").on(table.symbolId)
  })
);

export const tradeJournalEntries = pgTable(
  "trade_journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    symbolId: uuid("symbol_id").references(() => symbols.id, { onDelete: "set null" }),
    strategyId: uuid("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    entryType: journalEntryType("entry_type").notNull().default("idea"),
    direction: journalDirection("direction").notNull().default("neutral"),
    status: journalStatus("status").notNull().default("draft"),
    entryPrice: money("entry_price"),
    exitPrice: money("exit_price"),
    quantity: money("quantity"),
    thesis: text("thesis"),
    riskNotes: text("risk_notes"),
    outcomeNotes: text("outcome_notes"),
    tags: jsonb("tags").$type<string[]>(),
    tradeDate: date("trade_date"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    organizationIdx: index("trade_journal_entries_organization_id_idx").on(table.organizationId),
    portfolioIdx: index("trade_journal_entries_portfolio_id_idx").on(table.portfolioId),
    symbolIdx: index("trade_journal_entries_symbol_id_idx").on(table.symbolId),
    strategyIdx: index("trade_journal_entries_strategy_id_idx").on(table.strategyId),
    createdByUserIdx: index("trade_journal_entries_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const paperAccounts = pgTable(
  "paper_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    startingCash: money("starting_cash").notNull(),
    cashBalance: money("cash_balance").notNull(),
    buyingPower: money("buying_power").notNull(),
    status: accountStatus("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    organizationIdx: index("paper_accounts_organization_id_idx").on(table.organizationId),
    portfolioIdx: index("paper_accounts_portfolio_id_idx").on(table.portfolioId),
    createdByUserIdx: index("paper_accounts_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const paperOrders = pgTable(
  "paper_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    paperAccountId: uuid("paper_account_id")
      .notNull()
      .references(() => paperAccounts.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    strategyId: uuid("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    side: orderSide("side").notNull(),
    orderType: orderType("order_type").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    quantity: money("quantity").notNull(),
    limitPrice: money("limit_price"),
    stopPrice: money("stop_price"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    filledAt: timestamp("filled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    clientOrderId: text("client_order_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    organizationIdx: index("paper_orders_organization_id_idx").on(table.organizationId),
    paperAccountIdx: index("paper_orders_paper_account_id_idx").on(table.paperAccountId),
    portfolioIdx: index("paper_orders_portfolio_id_idx").on(table.portfolioId),
    symbolIdx: index("paper_orders_symbol_id_idx").on(table.symbolId),
    strategyIdx: index("paper_orders_strategy_id_idx").on(table.strategyId),
    clientOrderUnique: uniqueIndex("paper_orders_client_order_id_unique").on(table.clientOrderId)
  })
);

export const paperFills = pgTable(
  "paper_fills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paperOrderId: uuid("paper_order_id")
      .notNull()
      .references(() => paperOrders.id, { onDelete: "cascade" }),
    paperAccountId: uuid("paper_account_id")
      .notNull()
      .references(() => paperAccounts.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    side: orderSide("side").notNull(),
    quantity: money("quantity").notNull(),
    fillPrice: money("fill_price").notNull(),
    fees: money("fees").notNull().default("0"),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    paperOrderIdx: index("paper_fills_paper_order_id_idx").on(table.paperOrderId),
    paperAccountIdx: index("paper_fills_paper_account_id_idx").on(table.paperAccountId),
    symbolIdx: index("paper_fills_symbol_id_idx").on(table.symbolId)
  })
);

export const paperPositions = pgTable(
  "paper_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    paperAccountId: uuid("paper_account_id")
      .notNull()
      .references(() => paperAccounts.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id")
      .notNull()
      .references(() => symbols.id, { onDelete: "restrict" }),
    quantity: money("quantity").notNull(),
    averagePrice: money("average_price").notNull(),
    costBasis: money("cost_basis").notNull(),
    marketPrice: money("market_price"),
    marketValue: money("market_value"),
    unrealizedPnl: money("unrealized_pnl"),
    realizedPnl: money("realized_pnl"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    organizationIdx: index("paper_positions_organization_id_idx").on(table.organizationId),
    paperAccountIdx: index("paper_positions_paper_account_id_idx").on(table.paperAccountId),
    symbolIdx: index("paper_positions_symbol_id_idx").on(table.symbolId),
    paperAccountSymbolUnique: uniqueIndex("paper_positions_account_symbol_unique").on(
      table.paperAccountId,
      table.symbolId
    )
  })
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    symbolId: uuid("symbol_id").references(() => symbols.id, { onDelete: "set null" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    strategyId: uuid("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    alertType: alertType("alert_type").notNull(),
    conditionType: alertConditionType("condition_type"),
    thresholdValue: money("threshold_value"),
    message: text("message").notNull(),
    status: alertStatus("status").notNull().default("active"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    organizationIdx: index("alerts_organization_id_idx").on(table.organizationId),
    userIdx: index("alerts_user_id_idx").on(table.userId),
    symbolIdx: index("alerts_symbol_id_idx").on(table.symbolId),
    portfolioIdx: index("alerts_portfolio_id_idx").on(table.portfolioId),
    strategyIdx: index("alerts_strategy_id_idx").on(table.strategyId)
  })
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    entityType: noteEntityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    body: text("body").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    organizationIdx: index("notes_organization_id_idx").on(table.organizationId),
    entityIdx: index("notes_entity_idx").on(table.entityType, table.entityId),
    createdByUserIdx: index("notes_created_by_user_id_idx").on(table.createdByUserId)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    organizationIdx: index("audit_events_organization_id_idx").on(table.organizationId),
    userIdx: index("audit_events_user_id_idx").on(table.userId),
    entityIdx: index("audit_events_entity_idx").on(table.entityType, table.entityId),
    eventTypeIdx: index("audit_events_event_type_idx").on(table.eventType)
  })
);

export type Symbol = typeof symbols.$inferSelect;
export type NewSymbol = typeof symbols.$inferInsert;
export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;
export type WatchlistSymbol = typeof watchlistSymbols.$inferSelect;
export type NewWatchlistSymbol = typeof watchlistSymbols.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type StrategyVersion = typeof strategyVersions.$inferSelect;
export type NewStrategyVersion = typeof strategyVersions.$inferInsert;
export type Backtest = typeof backtests.$inferSelect;
export type NewBacktest = typeof backtests.$inferInsert;
export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type NewBacktestTrade = typeof backtestTrades.$inferInsert;
export type TradeJournalEntry = typeof tradeJournalEntries.$inferSelect;
export type NewTradeJournalEntry = typeof tradeJournalEntries.$inferInsert;
export type PaperAccount = typeof paperAccounts.$inferSelect;
export type NewPaperAccount = typeof paperAccounts.$inferInsert;
export type PaperOrder = typeof paperOrders.$inferSelect;
export type NewPaperOrder = typeof paperOrders.$inferInsert;
export type PaperFill = typeof paperFills.$inferSelect;
export type NewPaperFill = typeof paperFills.$inferInsert;
export type PaperPosition = typeof paperPositions.$inferSelect;
export type NewPaperPosition = typeof paperPositions.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
