import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  PlusIcon,
  TrashIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react"

import { useI18n } from "@/i18n"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_DNS_HOSTS,
  getCustomHosts,
  LOCALES,
  resetHosts,
  saveHosts,
} from "@/lib/settings"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, messages } = useI18n()
  const [hosts, setHosts] = useState<string[]>(
    () => getCustomHosts() ?? [...DEFAULT_DNS_HOSTS]
  )
  const [newHost, setNewHost] = useState("")
  const localeOptions = [...LOCALES].sort((left, right) =>
    left.label.localeCompare(right.label, locale, { sensitivity: "base" })
  )

  // Persist hosts on every change — no separate "save" button UX.
  useEffect(() => {
    saveHosts(hosts)
  }, [hosts])

  const addHost = () => {
    const trimmed = newHost.trim().toLowerCase()
    if (!trimmed) return
    if (hosts.includes(trimmed)) {
      toast.error(messages.settings.duplicateHost(trimmed))
      return
    }
    setHosts((prev) => [...prev, trimmed])
    setNewHost("")
  }

  const removeHost = (host: string) => {
    setHosts((prev) => prev.filter((h) => h !== host))
  }

  const updateHost = (index: number, value: string) => {
    setHosts((prev) => prev.map((h, i) => (i === index ? value : h)))
  }

  const restoreDefaults = () => {
    resetHosts()
    setHosts([...DEFAULT_DNS_HOSTS])
    toast.success(messages.settings.defaultHostsRestored)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-balance">
          {messages.settings.title}
        </h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          {messages.settings.description}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.settings.appearanceTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Label htmlFor="theme-select">{messages.settings.themeLabel}</Label>
          <Select
            value={theme}
            onValueChange={(v) => setTheme(v as "system" | "light" | "dark")}
          >
            <SelectTrigger id="theme-select" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                {messages.common.theme.system}
              </SelectItem>
              <SelectItem value="light">
                {messages.common.theme.light}
              </SelectItem>
              <SelectItem value="dark">{messages.common.theme.dark}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.settings.localeTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="lang-select">{messages.settings.localeLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {messages.settings.localeDescription}
            </p>
          </div>
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as typeof locale)}
          >
            <SelectTrigger id="lang-select" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {localeOptions.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* DNS test hosts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              {messages.settings.dnsHostsTitle}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {messages.settings.dnsHostsDescription}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={restoreDefaults}
            title={messages.settings.restoreDefaultsTitle}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            {messages.settings.restoreDefaults}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {hosts.map((h, i) => (
              <div key={`${h}-${i}`} className="flex items-center gap-2">
                <Input
                  value={h}
                  onChange={(e) => updateHost(i, e.target.value)}
                  className="font-mono text-sm"
                  spellCheck={false}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeHost(h)}
                  aria-label={messages.settings.removeHost(h)}
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
            {hosts.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                {messages.settings.noHosts}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHost()}
              placeholder={messages.settings.addHostPlaceholder}
              className="font-mono text-sm"
              spellCheck={false}
            />
            <Button onClick={addHost} disabled={!newHost.trim()}>
              <PlusIcon data-icon="inline-start" />
              {messages.settings.addHost}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
