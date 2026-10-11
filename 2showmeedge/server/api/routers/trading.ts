import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import {
  holdingCreateSchema,
  holdingDeleteSchema,
  holdingListSchema,
  holdingUpdateSchema,
  portfolioCreateSchema,
  portfolioDeleteSchema,
  portfolioUpdateSchema,
  symbolCreateSchema,
  symbolDeleteSchema,
  symbolListSchema,
  symbolUpdateSchema,
  watchlistCreateSchema,
  watchlistDeleteSchema,
  watchlistSymbolCreateSchema,
  watchlistSymbolDeleteSchema,
  watchlistSymbolListSchema,
  watchlistSymbolUpdateSchema,
  watchlistUpdateSchema
} from "@/lib/trading-validators";
import { protectedProcedure, router } from "@/server/api/trpc";
import { db } from "@/server/db";
import {
  holdings,
  portfolios,
  symbols,
  watchlists,
  watchlistSymbols
} from "@/server/db/trading-schema";

function money(value: number) {
  return String(value);
}

function nullableMoney(value: number | null | undefined) {
  return value == null ? null : String(value);
}

function updateMoney(value: number | undefined) {
  return value === undefined ? undefined : String(value);
}

async function getOwnedPortfolio(id: string, userId: string) {
  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.createdByUserId, userId), isNull(portfolios.deletedAt)))
    .limit(1);

  return portfolio;
}

async function getOwnedWatchlist(id: string, userId: string) {
  const [watchlist] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.createdByUserId, userId), isNull(watchlists.deletedAt)))
    .limit(1);

  return watchlist;
}

async function assertOwnedPortfolio(id: string, userId: string) {
  const portfolio = await getOwnedPortfolio(id, userId);

  if (!portfolio) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found" });
  }

  return portfolio;
}

async function assertOwnedWatchlist(id: string, userId: string) {
  const watchlist = await getOwnedWatchlist(id, userId);

  if (!watchlist) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist not found" });
  }

  return watchlist;
}

export const tradingRouter = router({
  accountContext: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    organizationId: ctx.organizationId
  })),

  symbols: router({
    list: protectedProcedure.input(symbolListSchema).query(async ({ input }) => {
      const filters = [];

      if (input.assetType !== "all") {
        filters.push(eq(symbols.assetType, input.assetType));
      }

      if (input.search) {
        filters.push(or(ilike(symbols.ticker, `%${input.search}%`), ilike(symbols.name, `%${input.search}%`)));
      }

      return db
        .select()
        .from(symbols)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(symbols.ticker);
    }),

    create: protectedProcedure.input(symbolCreateSchema).mutation(async ({ input }) => {
      const [symbol] = await db.insert(symbols).values(input).returning();

      return symbol;
    }),

    update: protectedProcedure.input(symbolUpdateSchema).mutation(async ({ input }) => {
      const { id, ...values } = input;
      const [symbol] = await db.update(symbols).set(values).where(eq(symbols.id, id)).returning();

      return symbol;
    }),

    delete: protectedProcedure.input(symbolDeleteSchema).mutation(async ({ input }) => {
      const [symbol] = await db.delete(symbols).where(eq(symbols.id, input.id)).returning({ id: symbols.id });

      return symbol;
    })
  }),

  portfolios: router({
    list: protectedProcedure.query(({ ctx }) =>
      db
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.createdByUserId, ctx.userId), isNull(portfolios.deletedAt)))
        .orderBy(desc(portfolios.createdAt))
    ),

    create: protectedProcedure.input(portfolioCreateSchema).mutation(async ({ ctx, input }) => {
      const [portfolio] = await db
        .insert(portfolios)
        .values({
          name: input.name,
          description: input.description,
          baseCurrency: input.baseCurrency,
          portfolioType: input.portfolioType,
          visibility: input.visibility,
          organizationId: ctx.organizationId,
          startingCash: money(input.startingCash),
          currentCash: money(input.currentCash),
          isDefault: input.isDefault,
          createdByUserId: ctx.userId
        })
        .returning();

      return portfolio;
    }),

    update: protectedProcedure.input(portfolioUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [portfolio] = await db
        .update(portfolios)
        .set({
          name: values.name,
          description: values.description,
          baseCurrency: values.baseCurrency,
          portfolioType: values.portfolioType,
          visibility: values.visibility,
          startingCash: updateMoney(values.startingCash),
          currentCash: updateMoney(values.currentCash),
          isDefault: values.isDefault
        })
        .where(and(eq(portfolios.id, id), eq(portfolios.createdByUserId, ctx.userId)))
        .returning();

      return portfolio;
    }),

    delete: protectedProcedure.input(portfolioDeleteSchema).mutation(async ({ ctx, input }) => {
      const [portfolio] = await db
        .update(portfolios)
        .set({ deletedAt: new Date() })
        .where(and(eq(portfolios.id, input.id), eq(portfolios.createdByUserId, ctx.userId)))
        .returning({ id: portfolios.id });

      return portfolio;
    })
  }),

  holdings: router({
    list: protectedProcedure.input(holdingListSchema).query(async ({ ctx, input }) => {
      const ownedPortfolios = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(and(eq(portfolios.createdByUserId, ctx.userId), isNull(portfolios.deletedAt)));

      const portfolioIds = ownedPortfolios.map((portfolio) => portfolio.id);
      if (!portfolioIds.length) return [];

      const selectedPortfolioIds = input.portfolioId === "all" ? portfolioIds : portfolioIds.filter((id) => id === input.portfolioId);
      if (!selectedPortfolioIds.length) return [];

      return db
        .select({
          holding: holdings,
          symbol: symbols,
          portfolio: portfolios
        })
        .from(holdings)
        .innerJoin(symbols, eq(holdings.symbolId, symbols.id))
        .innerJoin(portfolios, eq(holdings.portfolioId, portfolios.id))
        .where(inArray(holdings.portfolioId, selectedPortfolioIds))
        .orderBy(desc(holdings.updatedAt));
    }),

    create: protectedProcedure.input(holdingCreateSchema).mutation(async ({ ctx, input }) => {
      const portfolio = await assertOwnedPortfolio(input.portfolioId, ctx.userId);
      const computedCostBasis = input.costBasis ?? input.quantity * input.averageCost;
      const computedMarketValue = input.marketValue ?? (input.marketPrice == null ? null : input.quantity * input.marketPrice);

      const [holding] = await db
        .insert(holdings)
        .values({
          portfolioId: input.portfolioId,
          symbolId: input.symbolId,
          organizationId: portfolio.organizationId,
          quantity: money(input.quantity),
          averageCost: money(input.averageCost),
          costBasis: money(computedCostBasis),
          marketPrice: nullableMoney(input.marketPrice),
          marketValue: nullableMoney(computedMarketValue),
          unrealizedPnl: nullableMoney(input.unrealizedPnl),
          realizedPnl: nullableMoney(input.realizedPnl),
          notes: input.notes
        })
        .returning();

      return holding;
    }),

    update: protectedProcedure.input(holdingUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [existing] = await db.select().from(holdings).where(eq(holdings.id, id)).limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Holding not found" });
      }

      await assertOwnedPortfolio(values.portfolioId ?? existing.portfolioId, ctx.userId);

      const quantity = values.quantity ?? Number(existing.quantity);
      const averageCost = values.averageCost ?? Number(existing.averageCost);
      const marketPrice = values.marketPrice ?? (existing.marketPrice == null ? null : Number(existing.marketPrice));
      const costBasis = values.costBasis ?? quantity * averageCost;
      const marketValue = values.marketValue ?? (marketPrice == null ? null : quantity * marketPrice);

      const [holding] = await db
        .update(holdings)
        .set({
          portfolioId: values.portfolioId,
          symbolId: values.symbolId,
          quantity: updateMoney(values.quantity),
          averageCost: updateMoney(values.averageCost),
          costBasis: money(costBasis),
          marketPrice: values.marketPrice === undefined ? undefined : nullableMoney(values.marketPrice),
          marketValue: nullableMoney(marketValue),
          unrealizedPnl: values.unrealizedPnl === undefined ? undefined : nullableMoney(values.unrealizedPnl),
          realizedPnl: values.realizedPnl === undefined ? undefined : nullableMoney(values.realizedPnl),
          notes: values.notes
        })
        .where(eq(holdings.id, id))
        .returning();

      return holding;
    }),

    delete: protectedProcedure.input(holdingDeleteSchema).mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(holdings).where(eq(holdings.id, input.id)).limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Holding not found" });
      }

      await assertOwnedPortfolio(existing.portfolioId, ctx.userId);

      const [holding] = await db.delete(holdings).where(eq(holdings.id, input.id)).returning({ id: holdings.id });

      return holding;
    })
  }),

  watchlists: router({
    list: protectedProcedure.query(({ ctx }) =>
      db
        .select()
        .from(watchlists)
        .where(and(eq(watchlists.createdByUserId, ctx.userId), isNull(watchlists.deletedAt)))
        .orderBy(watchlists.sortOrder, desc(watchlists.createdAt))
    ),

    create: protectedProcedure.input(watchlistCreateSchema).mutation(async ({ ctx, input }) => {
      const [watchlist] = await db
        .insert(watchlists)
        .values({
          ...input,
          organizationId: ctx.organizationId,
          createdByUserId: ctx.userId
        })
        .returning();

      return watchlist;
    }),

    update: protectedProcedure.input(watchlistUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [watchlist] = await db
        .update(watchlists)
        .set(values)
        .where(and(eq(watchlists.id, id), eq(watchlists.createdByUserId, ctx.userId)))
        .returning();

      return watchlist;
    }),

    delete: protectedProcedure.input(watchlistDeleteSchema).mutation(async ({ ctx, input }) => {
      const [watchlist] = await db
        .update(watchlists)
        .set({ deletedAt: new Date() })
        .where(and(eq(watchlists.id, input.id), eq(watchlists.createdByUserId, ctx.userId)))
        .returning({ id: watchlists.id });

      return watchlist;
    })
  }),

  watchlistSymbols: router({
    list: protectedProcedure.input(watchlistSymbolListSchema).query(async ({ ctx, input }) => {
      const ownedWatchlists = await db
        .select({ id: watchlists.id })
        .from(watchlists)
        .where(and(eq(watchlists.createdByUserId, ctx.userId), isNull(watchlists.deletedAt)));

      const watchlistIds = ownedWatchlists.map((watchlist) => watchlist.id);
      if (!watchlistIds.length) return [];

      const selectedWatchlistIds = input.watchlistId === "all" ? watchlistIds : watchlistIds.filter((id) => id === input.watchlistId);
      if (!selectedWatchlistIds.length) return [];

      return db
        .select({
          watchlistSymbol: watchlistSymbols,
          watchlist: watchlists,
          symbol: symbols
        })
        .from(watchlistSymbols)
        .innerJoin(watchlists, eq(watchlistSymbols.watchlistId, watchlists.id))
        .innerJoin(symbols, eq(watchlistSymbols.symbolId, symbols.id))
        .where(inArray(watchlistSymbols.watchlistId, selectedWatchlistIds))
        .orderBy(watchlistSymbols.sortOrder, symbols.ticker);
    }),

    create: protectedProcedure.input(watchlistSymbolCreateSchema).mutation(async ({ ctx, input }) => {
      await assertOwnedWatchlist(input.watchlistId, ctx.userId);

      const [watchlistSymbol] = await db
        .insert(watchlistSymbols)
        .values({
          ...input,
          addedByUserId: ctx.userId
        })
        .returning();

      return watchlistSymbol;
    }),

    update: protectedProcedure.input(watchlistSymbolUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [existing] = await db.select().from(watchlistSymbols).where(eq(watchlistSymbols.id, id)).limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist symbol not found" });
      }

      await assertOwnedWatchlist(values.watchlistId ?? existing.watchlistId, ctx.userId);

      const [watchlistSymbol] = await db.update(watchlistSymbols).set(values).where(eq(watchlistSymbols.id, id)).returning();

      return watchlistSymbol;
    }),

    delete: protectedProcedure.input(watchlistSymbolDeleteSchema).mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(watchlistSymbols).where(eq(watchlistSymbols.id, input.id)).limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist symbol not found" });
      }

      await assertOwnedWatchlist(existing.watchlistId, ctx.userId);

      const [watchlistSymbol] = await db.delete(watchlistSymbols).where(eq(watchlistSymbols.id, input.id)).returning({
        id: watchlistSymbols.id
      });

      return watchlistSymbol;
    })
  })
});
