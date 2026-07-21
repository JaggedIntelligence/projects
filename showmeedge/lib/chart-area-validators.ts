import { z } from "zod";

import { CHART_AREA_COLOR_KEYS, DEFAULT_CHART_AREA_COLOR_KEY } from "@/lib/chart-area-colors";

const tickerSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .transform((value) => value.toUpperCase());

const timeframeSchema = z.literal("1d");

export const chartAreaColorSchema = z.enum(CHART_AREA_COLOR_KEYS);

const chartTimeSchema = z.string().trim().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "Enter a valid date or timestamp"
});

export const chartAreaListSchema = z.object({
  ticker: tickerSchema,
  timeframe: timeframeSchema.default("1d")
});

export const chartAreaCreateSchema = z
  .object({
    ticker: tickerSchema,
    timeframe: timeframeSchema.default("1d"),
    startTime: chartTimeSchema,
    endTime: chartTimeSchema,
    topPrice: z.coerce.number().finite().positive(),
    bottomPrice: z.coerce.number().finite().positive(),
    colorKey: chartAreaColorSchema.default(DEFAULT_CHART_AREA_COLOR_KEY)
  })
  .superRefine((area, context) => {
    if (Date.parse(area.startTime) > Date.parse(area.endTime)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start time must be on or before end time",
        path: ["startTime"]
      });
    }

    if (area.topPrice <= area.bottomPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Top price must be greater than bottom price",
        path: ["topPrice"]
      });
    }
  });

export const chartAreaDeleteSchema = z.object({
  id: z.string().uuid()
});
