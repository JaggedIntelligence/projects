"use client";

import { Building2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { MarketChartPanel } from "@/components/trading/market-chart-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssetType, PortfolioType } from "@/lib/trading-validators";

const assetTypes: AssetType[] = ["stock", "etf", "crypto", "forex", "option"];
const portfolioTypes: PortfolioType[] = ["manual", "paper", "live"];

type SymbolForm = {
  id?: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  exchange: string;
  currency: string;
};

type PortfolioForm = {
  id?: string;
  name: string;
  description: string;
  portfolioType: PortfolioType;
  startingCash: string;
  currentCash: string;
};

type HoldingForm = {
  id?: string;
  portfolioId: string;
  symbolId: string;
  quantity: string;
  averageCost: string;
  marketPrice: string;
  notes: string;
};

type WatchlistForm = {
  id?: string;
  name: string;
  description: string;
};

type WatchlistSymbolForm = {
  id?: string;
  watchlistId: string;
  symbolId: string;
  notes: string;
  alertEnabled: boolean;
};

const emptySymbol: SymbolForm = {
  ticker: "",
  name: "",
  assetType: "stock",
  exchange: "NASDAQ",
  currency: "USD"
};

const emptyPortfolio: PortfolioForm = {
  name: "",
  description: "",
  portfolioType: "manual",
  startingCash: "0",
  currentCash: "0"
};

const emptyHolding: HoldingForm = {
  portfolioId: "",
  symbolId: "",
  quantity: "",
  averageCost: "",
  marketPrice: "",
  notes: ""
};

const emptyWatchlist: WatchlistForm = {
  name: "",
  description: ""
};

const emptyWatchlistSymbol: WatchlistSymbolForm = {
  watchlistId: "",
  symbolId: "",
  notes: "",
  alertEnabled: false
};

function toNumber(value: string) {
  return value.trim() ? Number(value) : 0;
}

function money(value: string | null) {
  return Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function compactId(value: string | null | undefined) {
  if (!value) return "None";
  return value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

type ChartPanelComponent = (props: { symbols: Array<{ id: string; ticker: string; name: string }> }) => JSX.Element;

export function TradingPage({ ChartPanel = MarketChartPanel }: { ChartPanel?: ChartPanelComponent } = {}) {
  const utils = api.useUtils();
  const account = api.trading.accountContext.useQuery();
  const symbolsQuery = api.trading.symbols.list.useQuery({ assetType: "all" });
  const portfoliosQuery = api.trading.portfolios.list.useQuery();
  const holdingsQuery = api.trading.holdings.list.useQuery({ portfolioId: "all" });
  const watchlistsQuery = api.trading.watchlists.list.useQuery();
  const watchlistSymbolsQuery = api.trading.watchlistSymbols.list.useQuery({ watchlistId: "all" });

  const [symbolForm, setSymbolForm] = useState<SymbolForm>(emptySymbol);
  const [portfolioForm, setPortfolioForm] = useState<PortfolioForm>(emptyPortfolio);
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(emptyHolding);
  const [watchlistForm, setWatchlistForm] = useState<WatchlistForm>(emptyWatchlist);
  const [watchlistSymbolForm, setWatchlistSymbolForm] = useState<WatchlistSymbolForm>(emptyWatchlistSymbol);

  const symbols = useMemo(() => symbolsQuery.data ?? [], [symbolsQuery.data]);
  const portfolios = useMemo(() => portfoliosQuery.data ?? [], [portfoliosQuery.data]);
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data]);
  const watchlists = useMemo(() => watchlistsQuery.data ?? [], [watchlistsQuery.data]);
  const watchlistSymbols = useMemo(() => watchlistSymbolsQuery.data ?? [], [watchlistSymbolsQuery.data]);

  const refreshTrading = async () => {
    await Promise.all([
      utils.trading.symbols.list.invalidate(),
      utils.trading.portfolios.list.invalidate(),
      utils.trading.holdings.list.invalidate(),
      utils.trading.watchlists.list.invalidate(),
      utils.trading.watchlistSymbols.list.invalidate()
    ]);
  };

  const createSymbol = api.trading.symbols.create.useMutation({ onSuccess: refreshTrading });
  const updateSymbol = api.trading.symbols.update.useMutation({ onSuccess: refreshTrading });
  const deleteSymbol = api.trading.symbols.delete.useMutation({ onSuccess: refreshTrading });
  const createPortfolio = api.trading.portfolios.create.useMutation({ onSuccess: refreshTrading });
  const updatePortfolio = api.trading.portfolios.update.useMutation({ onSuccess: refreshTrading });
  const deletePortfolio = api.trading.portfolios.delete.useMutation({ onSuccess: refreshTrading });
  const createHolding = api.trading.holdings.create.useMutation({ onSuccess: refreshTrading });
  const updateHolding = api.trading.holdings.update.useMutation({ onSuccess: refreshTrading });
  const deleteHolding = api.trading.holdings.delete.useMutation({ onSuccess: refreshTrading });
  const createWatchlist = api.trading.watchlists.create.useMutation({ onSuccess: refreshTrading });
  const updateWatchlist = api.trading.watchlists.update.useMutation({ onSuccess: refreshTrading });
  const deleteWatchlist = api.trading.watchlists.delete.useMutation({ onSuccess: refreshTrading });
  const createWatchlistSymbol = api.trading.watchlistSymbols.create.useMutation({ onSuccess: refreshTrading });
  const updateWatchlistSymbol = api.trading.watchlistSymbols.update.useMutation({ onSuccess: refreshTrading });
  const deleteWatchlistSymbol = api.trading.watchlistSymbols.delete.useMutation({ onSuccess: refreshTrading });

  useEffect(() => {
    setHoldingForm((current) => ({
      ...current,
      portfolioId: current.portfolioId || portfolios[0]?.id || "",
      symbolId: current.symbolId || symbols[0]?.id || ""
    }));
  }, [portfolios, symbols]);

  useEffect(() => {
    setWatchlistSymbolForm((current) => ({
      ...current,
      watchlistId: current.watchlistId || watchlists[0]?.id || "",
      symbolId: current.symbolId || symbols[0]?.id || ""
    }));
  }, [watchlists, symbols]);

  const symbolNameById = useMemo(() => new Map(symbols.map((symbol) => [symbol.id, symbol.ticker])), [symbols]);
  const watchlistNameById = useMemo(() => new Map(watchlists.map((watchlist) => [watchlist.id, watchlist.name])), [watchlists]);

  function submitSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ticker: symbolForm.ticker,
      name: symbolForm.name,
      assetType: symbolForm.assetType,
      exchange: symbolForm.exchange,
      currency: symbolForm.currency
    };

    if (symbolForm.id) {
      updateSymbol.mutate({ id: symbolForm.id, ...payload });
    } else {
      createSymbol.mutate(payload);
    }
    setSymbolForm(emptySymbol);
  }

  function submitPortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: portfolioForm.name,
      description: portfolioForm.description,
      portfolioType: portfolioForm.portfolioType,
      visibility: "private" as const,
      baseCurrency: "USD",
      startingCash: toNumber(portfolioForm.startingCash),
      currentCash: toNumber(portfolioForm.currentCash),
      isDefault: false
    };

    if (portfolioForm.id) {
      updatePortfolio.mutate({ id: portfolioForm.id, ...payload });
    } else {
      createPortfolio.mutate(payload);
    }
    setPortfolioForm(emptyPortfolio);
  }

  function submitHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      portfolioId: holdingForm.portfolioId,
      symbolId: holdingForm.symbolId,
      quantity: toNumber(holdingForm.quantity),
      averageCost: toNumber(holdingForm.averageCost),
      costBasis: null,
      marketPrice: holdingForm.marketPrice ? toNumber(holdingForm.marketPrice) : null,
      marketValue: null,
      unrealizedPnl: null,
      realizedPnl: null,
      notes: holdingForm.notes
    };

    if (holdingForm.id) {
      updateHolding.mutate({ id: holdingForm.id, ...payload });
    } else {
      createHolding.mutate(payload);
    }
    setHoldingForm({ ...emptyHolding, portfolioId: portfolios[0]?.id ?? "", symbolId: symbols[0]?.id ?? "" });
  }

  function submitWatchlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: watchlistForm.name,
      description: watchlistForm.description,
      sortOrder: 0,
      isDefault: false
    };

    if (watchlistForm.id) {
      updateWatchlist.mutate({ id: watchlistForm.id, ...payload });
    } else {
      createWatchlist.mutate(payload);
    }
    setWatchlistForm(emptyWatchlist);
  }

  function submitWatchlistSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      watchlistId: watchlistSymbolForm.watchlistId,
      symbolId: watchlistSymbolForm.symbolId,
      sortOrder: 0,
      notes: watchlistSymbolForm.notes,
      alertEnabled: watchlistSymbolForm.alertEnabled
    };

    if (watchlistSymbolForm.id) {
      updateWatchlistSymbol.mutate({ id: watchlistSymbolForm.id, ...payload });
    } else {
      createWatchlistSymbol.mutate(payload);
    }
    setWatchlistSymbolForm({
      ...emptyWatchlistSymbol,
      watchlistId: watchlists[0]?.id ?? "",
      symbolId: symbols[0]?.id ?? ""
    });
  }

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">Trading setup</h1>
        <p className="text-sm text-muted-foreground">Create the first portfolio, holding, watchlist, and symbol records for the app.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" />
              User
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Clerk user ID: <span className="font-mono text-foreground">{compactId(account.data?.userId)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Clerk org ID: <span className="font-mono text-foreground">{compactId(account.data?.organizationId)}</span>
          </CardContent>
        </Card>
      </div>

      <ChartPanel symbols={symbols.map((symbol) => ({ id: symbol.id, ticker: symbol.ticker, name: symbol.name }))} />

      <CrudSection title="Symbols" count={symbols.length}>
        <form className="grid gap-3 lg:grid-cols-[1fr_2fr_130px_130px_110px_auto]" onSubmit={submitSymbol}>
          <Field label="Ticker">
            <Input value={symbolForm.ticker} onChange={(event) => setSymbolForm({ ...symbolForm, ticker: event.target.value })} required />
          </Field>
          <Field label="Name">
            <Input value={symbolForm.name} onChange={(event) => setSymbolForm({ ...symbolForm, name: event.target.value })} required />
          </Field>
          <Field label="Type">
            <Select value={symbolForm.assetType} onValueChange={(value) => setSymbolForm({ ...symbolForm, assetType: value as AssetType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assetTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Exchange">
            <Input value={symbolForm.exchange} onChange={(event) => setSymbolForm({ ...symbolForm, exchange: event.target.value })} required />
          </Field>
          <Field label="Currency">
            <Input value={symbolForm.currency} onChange={(event) => setSymbolForm({ ...symbolForm, currency: event.target.value })} required />
          </Field>
          <FormActions isEditing={Boolean(symbolForm.id)} onCancel={() => setSymbolForm(emptySymbol)} />
        </form>
        <div className="grid gap-2">
          {symbols.map((symbol) => (
            <Row key={symbol.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{symbol.ticker}</span>
                  <Badge variant="outline">{symbol.assetType}</Badge>
                  <Badge variant="secondary">{symbol.exchange}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{symbol.name}</p>
              </div>
              <RowActions
                onEdit={() =>
                  setSymbolForm({
                    id: symbol.id,
                    ticker: symbol.ticker,
                    name: symbol.name,
                    assetType: symbol.assetType,
                    exchange: symbol.exchange,
                    currency: symbol.currency
                  })
                }
                onDelete={() => deleteSymbol.mutate({ id: symbol.id })}
              />
            </Row>
          ))}
        </div>
      </CrudSection>

      <CrudSection title="Portfolios" count={portfolios.length}>
        <form className="grid gap-3 lg:grid-cols-[1.2fr_2fr_130px_130px_130px_auto]" onSubmit={submitPortfolio}>
          <Field label="Name">
            <Input value={portfolioForm.name} onChange={(event) => setPortfolioForm({ ...portfolioForm, name: event.target.value })} required />
          </Field>
          <Field label="Description">
            <Input
              value={portfolioForm.description}
              onChange={(event) => setPortfolioForm({ ...portfolioForm, description: event.target.value })}
            />
          </Field>
          <Field label="Type">
            <Select
              value={portfolioForm.portfolioType}
              onValueChange={(value) => setPortfolioForm({ ...portfolioForm, portfolioType: value as PortfolioType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portfolioTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start cash">
            <Input
              type="number"
              value={portfolioForm.startingCash}
              onChange={(event) => setPortfolioForm({ ...portfolioForm, startingCash: event.target.value })}
            />
          </Field>
          <Field label="Cash">
            <Input
              type="number"
              value={portfolioForm.currentCash}
              onChange={(event) => setPortfolioForm({ ...portfolioForm, currentCash: event.target.value })}
            />
          </Field>
          <FormActions isEditing={Boolean(portfolioForm.id)} onCancel={() => setPortfolioForm(emptyPortfolio)} />
        </form>
        <div className="grid gap-2">
          {portfolios.map((portfolio) => (
            <Row key={portfolio.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{portfolio.name}</span>
                  <Badge variant="outline">{portfolio.portfolioType}</Badge>
                  <Badge variant="secondary">${money(portfolio.currentCash)}</Badge>
                </div>
                {portfolio.description ? <p className="text-sm text-muted-foreground">{portfolio.description}</p> : null}
              </div>
              <RowActions
                onEdit={() =>
                  setPortfolioForm({
                    id: portfolio.id,
                    name: portfolio.name,
                    description: portfolio.description ?? "",
                    portfolioType: portfolio.portfolioType,
                    startingCash: portfolio.startingCash,
                    currentCash: portfolio.currentCash
                  })
                }
                onDelete={() => deletePortfolio.mutate({ id: portfolio.id })}
              />
            </Row>
          ))}
        </div>
      </CrudSection>

      <CrudSection title="Holdings" count={holdings.length}>
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_120px_120px_1.4fr_auto]" onSubmit={submitHolding}>
          <Field label="Portfolio">
            <Select value={holdingForm.portfolioId} onValueChange={(value) => setHoldingForm({ ...holdingForm, portfolioId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((portfolio) => (
                  <SelectItem key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Symbol">
            <Select value={holdingForm.symbolId} onValueChange={(value) => setHoldingForm({ ...holdingForm, symbolId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol) => (
                  <SelectItem key={symbol.id} value={symbol.id}>
                    {symbol.ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Qty">
            <Input
              type="number"
              step="any"
              value={holdingForm.quantity}
              onChange={(event) => setHoldingForm({ ...holdingForm, quantity: event.target.value })}
              required
            />
          </Field>
          <Field label="Avg cost">
            <Input
              type="number"
              step="any"
              value={holdingForm.averageCost}
              onChange={(event) => setHoldingForm({ ...holdingForm, averageCost: event.target.value })}
              required
            />
          </Field>
          <Field label="Market">
            <Input
              type="number"
              step="any"
              value={holdingForm.marketPrice}
              onChange={(event) => setHoldingForm({ ...holdingForm, marketPrice: event.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input value={holdingForm.notes} onChange={(event) => setHoldingForm({ ...holdingForm, notes: event.target.value })} />
          </Field>
          <FormActions
            isEditing={Boolean(holdingForm.id)}
            onCancel={() => setHoldingForm({ ...emptyHolding, portfolioId: portfolios[0]?.id ?? "", symbolId: symbols[0]?.id ?? "" })}
            disabled={!portfolios.length || !symbols.length}
          />
        </form>
        <div className="grid gap-2">
          {holdings.map(({ holding, symbol, portfolio }) => (
            <Row key={holding.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{symbol.ticker}</span>
                  <Badge variant="secondary">{portfolio.name}</Badge>
                  <Badge variant="outline">{holding.quantity} shares</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Avg ${money(holding.averageCost)} · Cost ${money(holding.costBasis)}
                  {holding.marketValue ? ` · Market $${money(holding.marketValue)}` : ""}
                </p>
              </div>
              <RowActions
                onEdit={() =>
                  setHoldingForm({
                    id: holding.id,
                    portfolioId: holding.portfolioId,
                    symbolId: holding.symbolId,
                    quantity: holding.quantity,
                    averageCost: holding.averageCost,
                    marketPrice: holding.marketPrice ?? "",
                    notes: holding.notes ?? ""
                  })
                }
                onDelete={() => deleteHolding.mutate({ id: holding.id })}
              />
            </Row>
          ))}
        </div>
      </CrudSection>

      <CrudSection title="Watchlists" count={watchlists.length}>
        <form className="grid gap-3 lg:grid-cols-[1fr_3fr_auto]" onSubmit={submitWatchlist}>
          <Field label="Name">
            <Input value={watchlistForm.name} onChange={(event) => setWatchlistForm({ ...watchlistForm, name: event.target.value })} required />
          </Field>
          <Field label="Description">
            <Input
              value={watchlistForm.description}
              onChange={(event) => setWatchlistForm({ ...watchlistForm, description: event.target.value })}
            />
          </Field>
          <FormActions isEditing={Boolean(watchlistForm.id)} onCancel={() => setWatchlistForm(emptyWatchlist)} />
        </form>
        <div className="grid gap-2">
          {watchlists.map((watchlist) => (
            <Row key={watchlist.id}>
              <div>
                <span className="font-medium">{watchlist.name}</span>
                {watchlist.description ? <p className="text-sm text-muted-foreground">{watchlist.description}</p> : null}
              </div>
              <RowActions
                onEdit={() =>
                  setWatchlistForm({
                    id: watchlist.id,
                    name: watchlist.name,
                    description: watchlist.description ?? ""
                  })
                }
                onDelete={() => deleteWatchlist.mutate({ id: watchlist.id })}
              />
            </Row>
          ))}
        </div>
      </CrudSection>

      <CrudSection title="Watchlist Symbols" count={watchlistSymbols.length}>
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_120px_auto]" onSubmit={submitWatchlistSymbol}>
          <Field label="Watchlist">
            <Select
              value={watchlistSymbolForm.watchlistId}
              onValueChange={(value) => setWatchlistSymbolForm({ ...watchlistSymbolForm, watchlistId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Watchlist" />
              </SelectTrigger>
              <SelectContent>
                {watchlists.map((watchlist) => (
                  <SelectItem key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Symbol">
            <Select
              value={watchlistSymbolForm.symbolId}
              onValueChange={(value) => setWatchlistSymbolForm({ ...watchlistSymbolForm, symbolId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol) => (
                  <SelectItem key={symbol.id} value={symbol.id}>
                    {symbol.ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Input
              value={watchlistSymbolForm.notes}
              onChange={(event) => setWatchlistSymbolForm({ ...watchlistSymbolForm, notes: event.target.value })}
            />
          </Field>
          <Field label="Alert">
            <Select
              value={watchlistSymbolForm.alertEnabled ? "yes" : "no"}
              onValueChange={(value) => setWatchlistSymbolForm({ ...watchlistSymbolForm, alertEnabled: value === "yes" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Off</SelectItem>
                <SelectItem value="yes">On</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <FormActions
            isEditing={Boolean(watchlistSymbolForm.id)}
            onCancel={() =>
              setWatchlistSymbolForm({ ...emptyWatchlistSymbol, watchlistId: watchlists[0]?.id ?? "", symbolId: symbols[0]?.id ?? "" })
            }
            disabled={!watchlists.length || !symbols.length}
          />
        </form>
        <div className="grid gap-2">
          {watchlistSymbols.map(({ watchlistSymbol }) => (
            <Row key={watchlistSymbol.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{symbolNameById.get(watchlistSymbol.symbolId)}</span>
                  <Badge variant="secondary">{watchlistNameById.get(watchlistSymbol.watchlistId)}</Badge>
                  {watchlistSymbol.alertEnabled ? <Badge variant="outline">alert</Badge> : null}
                </div>
                {watchlistSymbol.notes ? <p className="text-sm text-muted-foreground">{watchlistSymbol.notes}</p> : null}
              </div>
              <RowActions
                onEdit={() =>
                  setWatchlistSymbolForm({
                    id: watchlistSymbol.id,
                    watchlistId: watchlistSymbol.watchlistId,
                    symbolId: watchlistSymbol.symbolId,
                    notes: watchlistSymbol.notes ?? "",
                    alertEnabled: watchlistSymbol.alertEnabled
                  })
                }
                onDelete={() => deleteWatchlistSymbol.mutate({ id: watchlistSymbol.id })}
              />
            </Row>
          ))}
        </div>
      </CrudSection>
    </main>
  );
}

function CrudSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormActions({ isEditing, onCancel, disabled = false }: { isEditing: boolean; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <Button type="submit" disabled={disabled}>
        <Plus className="h-4 w-4" />
        {isEditing ? "Save" : "Add"}
      </Button>
      {isEditing ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center">{children}</div>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="icon" aria-label="Edit" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Delete" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
