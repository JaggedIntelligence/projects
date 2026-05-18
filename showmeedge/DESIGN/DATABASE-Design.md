# Database Design

## Scope

This document expands the Phase 1 database model from `DESIGN2-revised.md`.

Phase 1 uses the existing Next.js, Postgres, and Drizzle ORM application as the main product app. Postgres should store product/application state:

- User portfolios.
- Holdings.
- Watchlists.
- Strategy configs.
- Backtest records.
- Paper trading state.
- Trade journal entries.
- Alerts.
- Audit trail.

Postgres should not yet try to become a full market data warehouse. Historical OHLCV/ticks can come later through FastAPI and QuestDB.

## Tables To Add Or Reuse

The revised design listed:

```text
users
organizations
portfolios
holdings
watchlists
watchlist_symbols
strategies
strategy_versions
trade_journal_entries
paper_accounts
paper_orders
paper_positions
alerts
audit_events
```

Recommended additions:

```text
symbols
backtests
backtest_trades
paper_fills
notes
```

`users` and `organizations` likely already exist in the current application. If so, reuse them rather than recreating them.

## Core Principle

For Phase 1:

```text
Next.js owns app/product tables.
FastAPI later owns finance/data computation and QuestDB workflows.
```

Avoid letting both Next.js and FastAPI freely write to the same Postgres tables.

## Shared Columns

Most app-owned tables should have:

```text
id
organization_id
created_by_user_id
created_at
updated_at
deleted_at nullable
```

Use `deleted_at` if the existing app already uses soft deletes. If the existing app uses hard deletes, follow that pattern.

For financial numbers, prefer Postgres `numeric`, not float:

```text
quantity numeric(24, 8)
price numeric(24, 8)
amount numeric(24, 8)
```

## 1. users

If the existing app already has this table, do not recreate it. Reuse it.

High-level columns:

```text
id
clerk_user_id / auth_provider_user_id
email
name
image_url
default_organization_id
created_at
updated_at
```

If the app already supports users, trading tables should reference `users.id`.

## 2. organizations

This likely already exists too.

High-level columns:

```text
id
name
slug
created_at
updated_at
```

Trading tables should usually belong to an organization, even if today the app is used by one person. This gives a clean path to teams later.

## 3. symbols

Add this table. Many trading tables should reference symbols.

High-level columns:

```text
id
ticker
name
asset_type
exchange
currency
country
sector
industry
is_active
metadata jsonb
created_at
updated_at
```

Example values:

```text
ticker: AAPL
name: Apple Inc.
asset_type: stock, etf, crypto, forex, option
exchange: NASDAQ, NYSE
currency: USD
country: US
```

Recommended unique constraint:

```text
unique(ticker, exchange, asset_type)
```

For an MVP, `ticker` alone may feel enough, but multi-exchange assets, crypto pairs, options, and tickers such as `BRK.B` get messy later.

## 4. portfolios

A user or organization can have multiple portfolios.

High-level columns:

```text
id
organization_id
name
description
base_currency
portfolio_type
visibility
starting_cash
current_cash
is_default
created_by_user_id
created_at
updated_at
deleted_at
```

Example values:

```text
base_currency: USD
portfolio_type: manual, paper, live
visibility: private, org
```

Example portfolios:

```text
Long Term
Swing Trading
Paper Trading
Dividend Portfolio
```

## 5. holdings

Represents current or manually entered holdings.

High-level columns:

```text
id
organization_id
portfolio_id
symbol_id
quantity
average_cost
cost_basis
market_price nullable
market_value nullable
unrealized_pnl nullable
realized_pnl nullable
opened_at nullable
last_price_at nullable
notes
created_at
updated_at
```

Decision to make:

```text
Should holdings be manually editable, or derived from transactions/orders?
```

Recommendation:

```text
Manual editable holdings for MVP.
Derived holdings later once paper/live trading becomes real.
```

## 6. watchlists

High-level columns:

```text
id
organization_id
name
description
sort_order
is_default
created_by_user_id
created_at
updated_at
deleted_at
```

## 7. watchlist_symbols

Join table between watchlists and symbols.

High-level columns:

```text
id
watchlist_id
symbol_id
sort_order
notes
alert_enabled
added_by_user_id
created_at
```

Recommended unique constraint:

```text
unique(watchlist_id, symbol_id)
```

## 8. strategies

This is the high-level strategy identity.

High-level columns:

```text
id
organization_id
name
description
strategy_type
status
default_symbol_id nullable
timeframe
created_by_user_id
created_at
updated_at
deleted_at
```

Example values:

```text
strategy_type: manual, rules_based, imported, python_later
status: draft, active, archived
timeframe: 1d, 1h, 15m
```

Example strategies:

```text
Moving Average Crossover
RSI Mean Reversion
Breakout Strategy
```

## 9. strategy_versions

Strategy configs should be versioned so old backtests remain reproducible.

High-level columns:

```text
id
strategy_id
version_number
name
description
config jsonb
entry_rules jsonb
exit_rules jsonb
risk_rules jsonb
is_active
created_by_user_id
created_at
```

Example `config`:

```json
{
  "fastSma": 20,
  "slowSma": 50,
  "timeframe": "1d",
  "symbols": ["AAPL", "MSFT"]
}
```

For MVP, JSONB is the right choice. Avoid over-normalizing strategy logic too early.

## 10. backtests

Backtests were mentioned in the prose and should be explicit.

High-level columns:

```text
id
organization_id
strategy_id
strategy_version_id
portfolio_id nullable
name
status
symbols jsonb
timeframe
start_date
end_date
initial_cash
final_equity
total_return
max_drawdown
sharpe_ratio nullable
win_rate nullable
trade_count
error_message nullable
result_summary jsonb
started_at
completed_at
created_by_user_id
created_at
updated_at
```

Example values:

```text
status: pending, running, completed, failed
```

For Phase 1, store summary metrics in Postgres. Later, large equity curves can move to QuestDB or object storage.

## 11. backtest_trades

Optional in the very early MVP, but useful if backtests are part of Phase 1.

High-level columns:

```text
id
backtest_id
symbol_id
side
quantity
entry_price
exit_price nullable
entry_time
exit_time nullable
pnl
pnl_percent
fees
metadata jsonb
created_at
```

Example values:

```text
side: buy, sell, short, cover
```

## 12. trade_journal_entries

This is useful even before real trading.

High-level columns:

```text
id
organization_id
portfolio_id nullable
symbol_id nullable
strategy_id nullable
title
entry_type
direction
status
entry_price nullable
exit_price nullable
quantity nullable
thesis
risk_notes
outcome_notes
tags jsonb
trade_date nullable
created_by_user_id
created_at
updated_at
deleted_at
```

Example values:

```text
entry_type: idea, planned_trade, executed_trade, review
direction: long, short, neutral
status: draft, planned, open, closed, reviewed
```

This lets the app be useful before automation exists.

## 13. paper_accounts

High-level columns:

```text
id
organization_id
portfolio_id
name
base_currency
starting_cash
cash_balance
buying_power
status
created_by_user_id
created_at
updated_at
```

Example values:

```text
status: active, paused, archived
```

A paper account can be tied to a portfolio or be the portfolio itself. Keeping `paper_accounts` separate is slightly better because future live broker accounts may follow the same pattern.

## 14. paper_orders

High-level columns:

```text
id
organization_id
paper_account_id
portfolio_id
symbol_id
strategy_id nullable
side
order_type
status
quantity
limit_price nullable
stop_price nullable
submitted_at
filled_at nullable
cancelled_at nullable
rejected_reason nullable
client_order_id
metadata jsonb
created_at
updated_at
```

Example values:

```text
side: buy, sell
order_type: market, limit, stop, stop_limit
status: pending, filled, partially_filled, cancelled, rejected
```

Use `client_order_id` for idempotency later.

## 15. paper_fills

Orders and fills are not the same thing, so include a separate fills table.

High-level columns:

```text
id
paper_order_id
paper_account_id
symbol_id
side
quantity
fill_price
fees
filled_at
created_at
```

This allows one order to have multiple fills later.

## 16. paper_positions

Current position state for paper trading.

High-level columns:

```text
id
organization_id
paper_account_id
symbol_id
quantity
average_price
cost_basis
market_price nullable
market_value nullable
unrealized_pnl nullable
realized_pnl nullable
opened_at nullable
updated_at
```

Recommended unique constraint:

```text
unique(paper_account_id, symbol_id)
```

## 17. alerts

High-level columns:

```text
id
organization_id
user_id nullable
symbol_id nullable
portfolio_id nullable
strategy_id nullable
alert_type
condition_type
threshold_value nullable
message
status
triggered_at nullable
created_at
updated_at
```

Example values:

```text
alert_type: price, strategy_signal, portfolio, system
condition_type: above, below, crosses_above, crosses_below
status: active, triggered, paused, archived
```

For MVP, alerts can be manually created and stored. Actual alert evaluation can come later.

## 18. notes

Could be a generic notes table attached to multiple entities.

High-level columns:

```text
id
organization_id
entity_type
entity_id
body
created_by_user_id
created_at
updated_at
deleted_at
```

Example values:

```text
entity_type: portfolio, symbol, strategy, trade_journal, backtest
```

This is useful, but optional if `trade_journal_entries` already covers most note-taking.

## 19. audit_events

Very important for trading-related products.

High-level columns:

```text
id
organization_id
user_id nullable
event_type
entity_type
entity_id
before jsonb nullable
after jsonb nullable
metadata jsonb
ip_address nullable
user_agent nullable
created_at
```

Example values:

```text
event_type: portfolio.created, strategy.updated, paper_order.submitted
```

This gives a record of important changes.

## Recommended Phase 1 Table Set

For the first CRUD-focused milestone, start with:

```text
symbols
portfolios
holdings
watchlists
watchlist_symbols
strategies
strategy_versions
trade_journal_entries
alerts
audit_events
```

Then add:

```text
backtests
backtest_trades
paper_accounts
paper_orders
paper_fills
paper_positions
notes
```

This keeps the first migration manageable.

## Open Decision

The key design choice before code:

```text
Should holdings be manually editable in MVP, or derived from transactions/orders from day one?
```

Recommendation:

```text
Manual editable holdings for MVP.
Derived holdings later once paper/live trading becomes real.
```

