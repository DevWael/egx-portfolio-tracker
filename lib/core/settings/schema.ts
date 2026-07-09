import { z } from "zod";

export const RANGE_VALUES = ["1W", "1M", "3M", "6M", "1Y", "max"] as const;
export const DATE_FORMAT_VALUES = ["en-GB", "iso", "en-US"] as const;

export const SettingsSchema = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color")
    .default("#34d399"),
  defaultPriceHistoryRange: z.enum(RANGE_VALUES).default("max"),
  dateFormat: z.enum(DATE_FORMAT_VALUES).default("en-GB"),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type PriceHistoryRange = (typeof RANGE_VALUES)[number];
export type DateFormat = (typeof DATE_FORMAT_VALUES)[number];

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export const RANGE_DAYS: Record<PriceHistoryRange, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  max: null,
};
