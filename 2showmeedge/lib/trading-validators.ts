import { z } from "zod";

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const optionalMoney = z
  .union([z.coerce.number().finite(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value === "" || value == null ? null : value));

export const uuidSchema = z.string().uuid();
export const assetTypeSchema = z.enum(["stock", "etf", "crypto", "forex", "option"]);
export const portfolioTypeSchema = z.enum(["manual", "paper", "live"]);
export const portfolioVisibilitySchema = z.enum(["private", "org"]);

export const symbolCreateSchema = z.object({
  ticker: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  assetType: assetTypeSchema.default("stock"),
  exchange: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  currency: z.string().trim().min(3).max(8).default("USD").transform((value) => value.toUpperCase()),
  country: nullableText,
  sector: nullableText,
  industry: nullableText,
  isActive: z.boolean().default(true)
});

export const symbolUpdateSchema = symbolCreateSchema.partial().extend({
  id: uuidSchema
});

export const symbolDeleteSchema = z.object({
  id: uuidSchema
});

export const symbolListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  assetType: z.union([assetTypeSchema, z.literal("all")]).default("all")
});

export const portfolioCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: nullableText,
  baseCurrency: z.string().trim().min(3).max(8).default("USD").transform((value) => value.toUpperCase()),
  portfolioType: portfolioTypeSchema.default("manual"),
  visibility: portfolioVisibilitySchema.default("private"),
  startingCash: z.coerce.number().finite().min(0).default(0),
  currentCash: z.coerce.number().finite().min(0).default(0),
  isDefault: z.boolean().default(false)
});

export const portfolioUpdateSchema = portfolioCreateSchema.partial().extend({
  id: uuidSchema
});

export const portfolioDeleteSchema = z.object({
  id: uuidSchema
});

export const holdingCreateSchema = z.object({
  portfolioId: uuidSchema,
  symbolId: uuidSchema,
  quantity: z.coerce.number().finite(),
  averageCost: z.coerce.number().finite().min(0),
  costBasis: optionalMoney,
  marketPrice: optionalMoney,
  marketValue: optionalMoney,
  unrealizedPnl: optionalMoney,
  realizedPnl: optionalMoney,
  notes: nullableText
});

export const holdingUpdateSchema = holdingCreateSchema.partial().extend({
  id: uuidSchema
});

export const holdingDeleteSchema = z.object({
  id: uuidSchema
});

export const holdingListSchema = z.object({
  portfolioId: z.union([uuidSchema, z.literal("all")]).default("all")
});

export const watchlistCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: nullableText,
  sortOrder: z.coerce.number().int().default(0),
  isDefault: z.boolean().default(false)
});

export const watchlistUpdateSchema = watchlistCreateSchema.partial().extend({
  id: uuidSchema
});

export const watchlistDeleteSchema = z.object({
  id: uuidSchema
});

export const watchlistSymbolCreateSchema = z.object({
  watchlistId: uuidSchema,
  symbolId: uuidSchema,
  sortOrder: z.coerce.number().int().default(0),
  notes: nullableText,
  alertEnabled: z.boolean().default(false)
});

export const watchlistSymbolUpdateSchema = watchlistSymbolCreateSchema.partial().extend({
  id: uuidSchema
});

export const watchlistSymbolDeleteSchema = z.object({
  id: uuidSchema
});

export const watchlistSymbolListSchema = z.object({
  watchlistId: z.union([uuidSchema, z.literal("all")]).default("all")
});

export type AssetType = z.infer<typeof assetTypeSchema>;
export type PortfolioType = z.infer<typeof portfolioTypeSchema>;
export type PortfolioVisibility = z.infer<typeof portfolioVisibilitySchema>;
