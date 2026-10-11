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

export function NightVisionOuterlayerPage({ ChartPanel = MarketChartPanel }: { ChartPanel?: ChartPanelComponent } = {}) {
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

  /*
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
*/
  

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Simple Ticker Chart </p>
      </div>

      <ChartPanel symbols={symbols.map((symbol) => ({ id: symbol.id, ticker: symbol.ticker, name: symbol.name }))} />

    </main>
  );
}



 