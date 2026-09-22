import * as React from "react"
import { DirectionProvider } from "@radix-ui/react-direction"

import { getLocale, saveLocale } from "@/lib/settings"

import {
  LOCALE_DIRECTIONS,
  type LocaleCode,
  type TextDirection,
} from "./config"
import { de } from "./locales/de"
import { en, type Messages } from "./locales/en"
import { es } from "./locales/es"
import { fr } from "./locales/fr"
import { ar } from "./locales/ar"
import { it } from "./locales/it"
import { id } from "./locales/id"
import { ja } from "./locales/ja"
import { nl } from "./locales/nl"
import { pl } from "./locales/pl"
import { ptBR } from "./locales/pt-BR"
import { tr } from "./locales/tr"
import { zhCN } from "./locales/zh-CN"

const MESSAGES: Record<LocaleCode, Messages> = {
  en,
  tr,
  es,
  de,
  fr,
  ar,
  "pt-BR": ptBR,
  it,
  nl,
  pl,
  ja,
  id,
  "zh-CN": zhCN,
}

interface I18nContextValue {
  locale: LocaleCode
  setLocale: (locale: LocaleCode) => void
  messages: Messages
  formatDate: (
    value: number | string | Date,
    options?: Intl.DateTimeFormatOptions
  ) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  dir: TextDirection
}

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined)

function createFormatKey(
  options?: Intl.DateTimeFormatOptions | Intl.NumberFormatOptions
) {
  return JSON.stringify(options ?? {})
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<LocaleCode>(() => getLocale())
  const dateFormatters = React.useRef(new Map<string, Intl.DateTimeFormat>())
  const numberFormatters = React.useRef(new Map<string, Intl.NumberFormat>())

  React.useEffect(() => {
    dateFormatters.current.clear()
    numberFormatters.current.clear()
  }, [locale])

  React.useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = LOCALE_DIRECTIONS[locale]
  }, [locale])

  const setLocale = (nextLocale: LocaleCode) => {
    saveLocale(nextLocale)
    setLocaleState(nextLocale)
  }

  const formatDate = (
    value: number | string | Date,
    options?: Intl.DateTimeFormatOptions
  ) => {
    const key = createFormatKey(options)
    let formatter = dateFormatters.current.get(key)

    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, options)
      dateFormatters.current.set(key, formatter)
    }

    const date = value instanceof Date ? value : new Date(value)
    return formatter.format(date)
  }

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    const key = createFormatKey(options)
    let formatter = numberFormatters.current.get(key)

    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options)
      numberFormatters.current.set(key, formatter)
    }

    return formatter.format(value)
  }

  const contextValue: I18nContextValue = {
    locale,
    setLocale,
    messages: MESSAGES[locale],
    formatDate,
    formatNumber,
    dir: LOCALE_DIRECTIONS[locale],
  }

  return (
    <I18nContext.Provider value={contextValue}>
      <DirectionProvider dir={contextValue.dir}>{children}</DirectionProvider>
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = React.useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used within an <I18nProvider>")
  }

  return context
}
