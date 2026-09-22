export const DEFAULT_LOCALE = "en" as const

export type LocaleCode =
  | "en"
  | "tr"
  | "es"
  | "de"
  | "fr"
  | "pt-BR"
  | "it"
  | "nl"
  | "pl"
  | "ja"
  | "id"
  | "zh-CN"
  | "ar"
export type TextDirection = "ltr" | "rtl"

export const SUPPORTED_LOCALES: LocaleCode[] = [
  "en",
  "tr",
  "es",
  "de",
  "fr",
  "pt-BR",
  "it",
  "nl",
  "pl",
  "ja",
  "id",
  "zh-CN",
  "ar",
]

export const LOCALE_OPTIONS: { code: LocaleCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ja", label: "日本語" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ar", label: "العربية" },
]

export const LOCALE_DIRECTIONS: Record<LocaleCode, TextDirection> = {
  en: "ltr",
  tr: "ltr",
  es: "ltr",
  de: "ltr",
  fr: "ltr",
  "pt-BR": "ltr",
  it: "ltr",
  nl: "ltr",
  pl: "ltr",
  ja: "ltr",
  id: "ltr",
  "zh-CN": "ltr",
  ar: "rtl",
}

export function isLocaleCode(
  value: string | null | undefined
): value is LocaleCode {
  return (
    value !== null &&
    value !== undefined &&
    SUPPORTED_LOCALES.includes(value as LocaleCode)
  )
}

export function normalizeLocaleCandidate(
  value: string | null | undefined
): LocaleCode | null {
  if (!value) return null

  const normalized = value.trim()
  if (!normalized) return null

  if (isLocaleCode(normalized)) {
    return normalized
  }

  const lower = normalized.toLowerCase()

  if (lower === "pt" || lower.startsWith("pt-")) return "pt-BR"
  if (lower === "en" || lower.startsWith("en-")) return "en"
  if (lower === "tr" || lower.startsWith("tr-")) return "tr"
  if (lower === "es" || lower.startsWith("es-")) return "es"
  if (lower === "de" || lower.startsWith("de-")) return "de"
  if (lower === "fr" || lower.startsWith("fr-")) return "fr"
  if (lower === "it" || lower.startsWith("it-")) return "it"
  if (lower === "nl" || lower.startsWith("nl-")) return "nl"
  if (lower === "pl" || lower.startsWith("pl-")) return "pl"
  if (lower === "ja" || lower.startsWith("ja-")) return "ja"
  if (lower === "id" || lower.startsWith("id-")) return "id"
  if (lower === "zh" || lower.startsWith("zh-")) return "zh-CN"
  if (lower === "ar" || lower.startsWith("ar-")) return "ar"

  return null
}

export function negotiateLocale(candidates: readonly string[]): LocaleCode {
  for (const candidate of candidates) {
    const normalized = normalizeLocaleCandidate(candidate)
    if (normalized) {
      return normalized
    }
  }

  return DEFAULT_LOCALE
}
