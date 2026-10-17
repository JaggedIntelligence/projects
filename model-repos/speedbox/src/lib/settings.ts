/**
 * Client-side user settings, persisted in localStorage. Pure helpers — no React
 * state wiring. For the DNS test domain list we return the effective list
 * (custom or defaults) so callers never have to fall back themselves.
 */

import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  negotiateLocale,
  normalizeLocaleCandidate,
  type LocaleCode,
} from "@/i18n/config"

export const DEFAULT_DNS_HOSTS = [
  "google.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "chatgpt.com",
  "x.com",
  "whatsapp.com",
  "reddit.com",
  "wikipedia.org",
  "amazon.com",
  "tiktok.com",
  "pinterest.com",
] as const

const HOSTS_KEY = "settings.dns-hosts"
const LOCALE_KEY = "settings.locale"
const LEGACY_LANGUAGE_KEY = "settings.language"

export type { LocaleCode }
export const LOCALES = LOCALE_OPTIONS

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // quota / private mode — ignore
  }
}

/** Get custom host list, or null if none configured (meaning: use defaults). */
export function getCustomHosts(): string[] | null {
  const raw = safeGet(HOSTS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed
    }
  } catch {
    // fall through
  }
  return null
}

/** Effective host list used by the DNS test — custom if set, otherwise defaults. */
export function getEffectiveHosts(): string[] {
  return getCustomHosts() ?? [...DEFAULT_DNS_HOSTS]
}

export function saveHosts(hosts: string[]) {
  const cleaned = hosts
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0)
  safeSet(HOSTS_KEY, JSON.stringify(cleaned))
}

export function resetHosts() {
  safeSet(HOSTS_KEY, null)
}

function getSystemLocale(): LocaleCode {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE
  }

  const candidates = [...navigator.languages]
  if (navigator.language) {
    candidates.push(navigator.language)
  }

  return negotiateLocale(candidates)
}

function migrateLegacyLanguage(): LocaleCode | null {
  const raw = safeGet(LEGACY_LANGUAGE_KEY)
  if (!raw) return null

  const locale = normalizeLocaleCandidate(raw) ?? getSystemLocale()
  safeSet(LOCALE_KEY, locale)
  safeSet(LEGACY_LANGUAGE_KEY, null)
  return locale
}

export function getLocale(): LocaleCode {
  const stored = normalizeLocaleCandidate(safeGet(LOCALE_KEY))
  if (stored) {
    return stored
  }

  safeSet(LOCALE_KEY, null)

  const migrated = migrateLegacyLanguage()
  if (migrated) {
    return migrated
  }

  const detected = getSystemLocale()
  saveLocale(detected)
  return detected
}

export function saveLocale(locale: LocaleCode) {
  safeSet(LOCALE_KEY, locale)
  safeSet(LEGACY_LANGUAGE_KEY, null)
}
