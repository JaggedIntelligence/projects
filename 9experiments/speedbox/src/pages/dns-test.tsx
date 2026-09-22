import { useState, useEffect, useRef } from "react"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts"
import {
  CaretUpIcon,
  CaretDownIcon,
  CaretUpDownIcon,
  KeyIcon,
  BroomIcon,
  TrophyIcon,
} from "@phosphor-icons/react"

import { useI18n } from "@/i18n"
import { trackedInvoke } from "@/lib/tauri"
import { getEffectiveHosts } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import { JuicyButton } from "@/components/ui/juicy-button"
import { CountUp } from "@/components/ui/count-up"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ResolverKind = "public" | "gateway" | "system"

export interface DnsResult {
  resolver_name: string
  resolver_addr: string
  resolver_kind: ResolverKind
  system_index?: number | null
  response_ms: number
  min_ms: number
  max_ms: number
  success: boolean
  queries_ok: number
  queries_total: number
  error: string | null
}

interface ResolverInfo {
  name: string
  addr: string
  resolver_kind: ResolverKind
  system_index?: number | null
  is_gateway?: boolean
  is_system?: boolean
}

interface DnsProgressPayload {
  resolver_name: string
  resolver_addr: string
  query_num: number
  queries_total: number
  latest_ms: number
}

interface ResolverProgress {
  query_num: number
  queries_total: number
  latest_ms: number
}

type SortKey = "name" | "addr" | "avg" | "min" | "max" | "queries"
type SortDir = "asc" | "desc"

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function SortableHead({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const isActive = active === sortKey
  const Icon = !isActive
    ? CaretUpDownIcon
    : dir === "asc"
      ? CaretUpIcon
      : CaretDownIcon

  return (
    <TableHead className={align === "right" ? "text-end" : undefined}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={
          "inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground " +
          (align === "right" ? "w-full justify-end" : "") +
          (isActive ? " text-foreground" : " text-muted-foreground")
        }
      >
        {label}
        <Icon className="size-3" />
      </button>
    </TableHead>
  )
}

function ResolverTags({
  info,
  gatewayLabel,
  currentLabel,
}: {
  info?: ResolverInfo
  gatewayLabel: string
  currentLabel: string
}) {
  if (!info) return null

  return (
    <div className="flex flex-wrap gap-1">
      {info.is_gateway && (
        <Badge variant="secondary" className="text-[10px]">
          {gatewayLabel}
        </Badge>
      )}
      {info.is_system && (
        <Badge variant="secondary" className="text-[10px]">
          {currentLabel}
        </Badge>
      )}
    </div>
  )
}

function colorForIndex(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function DnsTestPage() {
  const { locale, messages, formatNumber } = useI18n()
  const [resolvers, setResolvers] = useState<ResolverInfo[]>([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<DnsResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, ResolverProgress>>({})
  const [sortKey, setSortKey] = useState<SortKey>("avg")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [applyingAddr, setApplyingAddr] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)

  const domainCount = getEffectiveHosts().length

  const refreshResolvers = () => {
    trackedInvoke<ResolverInfo[]>("get_dns_resolvers")
      .then(setResolvers)
      .catch(console.error)
  }

  const getResolverLabel = (
    resolver:
      | Pick<DnsResult, "resolver_name" | "resolver_kind" | "system_index">
      | Pick<ResolverInfo, "name" | "resolver_kind" | "system_index">
  ) => {
    if (resolver.resolver_kind === "gateway") {
      return messages.dns.routerGateway
    }

    if (resolver.resolver_kind === "system") {
      const index = resolver.system_index ?? null
      return index && index > 1
        ? messages.dns.systemDnsNumber(index)
        : messages.dns.systemDns
    }

    return "resolver_name" in resolver ? resolver.resolver_name : resolver.name
  }

  const formatLatency = (value: number) =>
    formatNumber(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })

  const applyResolver = async (resolver: DnsResult) => {
    if (resolver.resolver_kind === "gateway") {
      setApplyingAddr(resolver.resolver_addr)
      const toastId = toast.loading(messages.dns.restoringAutomatic)
      try {
        await trackedInvoke("reset_dns")
        toast.success(messages.dns.resetAutomaticRouterSuccess, { id: toastId })
        refreshResolvers()
      } catch (invokeError) {
        toast.error(messages.dns.failedWith(String(invokeError)), {
          id: toastId,
        })
      } finally {
        setApplyingAddr(null)
      }
      return
    }

    const sameProvider = resolvers.filter(
      (candidate) =>
        candidate.resolver_kind === "public" &&
        candidate.name === resolver.resolver_name &&
        candidate.addr !== resolver.resolver_addr
    )
    const addrs = [
      resolver.resolver_addr,
      ...sameProvider.map((candidate) => candidate.addr),
    ]
    const resolverLabel = getResolverLabel(resolver)

    setApplyingAddr(resolver.resolver_addr)
    const toastId = toast.loading(
      messages.dns.applyingResolver(resolverLabel, addrs.join(", "))
    )
    try {
      await trackedInvoke("apply_dns", { addrs })
      toast.success(messages.dns.applySuccess(resolverLabel), { id: toastId })
      refreshResolvers()
    } catch (invokeError) {
      toast.error(messages.dns.failedWith(String(invokeError)), { id: toastId })
    } finally {
      setApplyingAddr(null)
    }
  }

  const resetDns = async () => {
    setResetting(true)
    const toastId = toast.loading(messages.dns.resettingAutomatic)
    try {
      await trackedInvoke("reset_dns")
      toast.success(messages.dns.resetAutomaticDhcpSuccess, { id: toastId })
      refreshResolvers()
    } catch (invokeError) {
      toast.error(messages.dns.failedWith(String(invokeError)), { id: toastId })
    } finally {
      setResetting(false)
    }
  }

  const flushCache = async () => {
    setFlushing(true)
    const toastId = toast.loading(messages.dns.flushingDnsCache)
    try {
      await trackedInvoke("flush_dns_cache")
      toast.success(messages.dns.dnsCacheFlushed, { id: toastId })
    } catch (invokeError) {
      toast.error(messages.dns.failedWith(String(invokeError)), { id: toastId })
    } finally {
      setFlushing(false)
    }
  }

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextSortKey)
    setSortDir("asc")
  }

  useEffect(() => {
    refreshResolvers()
    return () => {
      unlistenRef.current?.()
    }
  }, [])

  const runTest = async () => {
    setRunning(true)
    setResults(null)
    setError(null)
    setProgress({})

    const unlisten = await listen<DnsProgressPayload>(
      "dns-test-progress",
      (event) => {
        const payload = event.payload
        setProgress((current) => ({
          ...current,
          [payload.resolver_addr]: {
            query_num: payload.query_num,
            queries_total: payload.queries_total,
            latest_ms: payload.latest_ms,
          },
        }))
      }
    )
    unlistenRef.current = unlisten

    try {
      const nextResults = await trackedInvoke<DnsResult[]>("run_dns_test", {
        domains: getEffectiveHosts(),
      })
      setResults(nextResults)
    } catch (invokeError) {
      const message = String(invokeError)
      if (!message.toLowerCase().includes("cancelled")) {
        setError(message)
      }
    } finally {
      unlisten()
      unlistenRef.current = null
      setRunning(false)
      setCancelling(false)
    }
  }

  const cancelTest = async () => {
    setCancelling(true)
    try {
      await trackedInvoke("cancel_dns_test")
    } catch (invokeError) {
      console.error(invokeError)
    }
  }

  const winnerAddr = results
    ? ([...results]
        .filter(
          (resolver) => resolver.success && resolver.resolver_kind === "public"
        )
        .sort((left, right) => left.response_ms - right.response_ms)[0]
        ?.resolver_addr ?? null)
    : null

  const addrIndex = new Map(
    resolvers.map((resolver, index) => [resolver.addr, index])
  )
  const resolverByAddr = new Map(
    resolvers.map((resolver) => [resolver.addr, resolver])
  )
  const colorFor = (addr: string) => colorForIndex(addrIndex.get(addr) ?? 0)

  const topResults = results
    ? [...results]
        .filter((resolver) => resolver.success)
        .sort((left, right) => left.response_ms - right.response_ms)
        .slice(0, 10)
    : null

  const sortedResults = results
    ? [...results].sort((left, right) => {
        if (left.success !== right.success) {
          return left.success ? -1 : 1
        }

        const direction = sortDir === "asc" ? 1 : -1

        switch (sortKey) {
          case "name":
            return (
              getResolverLabel(left).localeCompare(
                getResolverLabel(right),
                locale
              ) * direction
            )
          case "addr":
            return (
              left.resolver_addr.localeCompare(right.resolver_addr, locale) *
              direction
            )
          case "avg":
            return (left.response_ms - right.response_ms) * direction
          case "min":
            return (left.min_ms - right.min_ms) * direction
          case "max":
            return (left.max_ms - right.max_ms) * direction
          case "queries":
            return (left.queries_ok - right.queries_ok) * direction
          default:
            return 0
        }
      })
    : null

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">
            {messages.dns.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolvers.length > 0
              ? messages.dns.summary(resolvers.length, domainCount)
              : messages.dns.emptySummary(domainCount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={flushCache}
            disabled={flushing || applyingAddr !== null || resetting}
            title={messages.dns.flushCacheTitle}
          >
            <BroomIcon data-icon="inline-start" />
            {flushing ? messages.dns.flushingCache : messages.dns.flushCache}
          </Button>
          <Button
            variant="outline"
            onClick={resetDns}
            disabled={resetting || applyingAddr !== null || flushing}
            title={messages.dns.resetTitle}
          >
            <KeyIcon data-icon="inline-start" />
            {resetting ? messages.dns.resetting : messages.dns.resetToAuto}
          </Button>
          {running ? (
            <Button
              onClick={cancelTest}
              disabled={cancelling}
              variant="destructive"
              className="w-28"
            >
              {cancelling ? messages.dns.cancelling : messages.dns.cancel}
            </Button>
          ) : (
            <JuicyButton
              onClick={runTest}
              disabled={resolvers.length === 0}
              className="w-28"
            >
              {results ? messages.dns.again : messages.dns.start}
            </JuicyButton>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {running && (
        <div className="anim-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resolvers.map((resolver) => {
            const resolverProgress = progress[resolver.addr]
            const progressPercent = resolverProgress
              ? (resolverProgress.query_num / resolverProgress.queries_total) *
                100
              : 0
            const active =
              resolverProgress &&
              resolverProgress.query_num < resolverProgress.queries_total

            return (
              <Card
                key={resolver.addr}
                className={active ? "anim-pulse-border" : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-sm font-semibold">
                      {getResolverLabel(resolver)}
                    </CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {resolverProgress
                        ? `${resolverProgress.query_num}/${resolverProgress.queries_total}`
                        : messages.dns.progressPending}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {resolver.addr}
                    </p>
                    <ResolverTags
                      info={resolver}
                      gatewayLabel={messages.dns.tags.gateway}
                      currentLabel={messages.dns.tags.current}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <Progress value={progressPercent} className="h-1.5" />
                  {resolverProgress && resolverProgress.latest_ms > 0 && (
                    <span className="font-heading text-base font-bold">
                      {formatLatency(resolverProgress.latest_ms)}
                      <span className="ms-1 text-xs font-normal text-muted-foreground">
                        {messages.common.units.ms}
                      </span>
                    </span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {results && (
        <>
          {topResults && topResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {messages.dns.topAverage(topResults.length)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, topResults.length * 28)}
                >
                  <BarChart
                    data={topResults.map((resolver) => ({
                      ...resolver,
                      label: `${getResolverLabel(resolver)} (${resolver.resolver_addr})`,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      unit={` ${messages.common.units.ms}`}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      width={180}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${formatLatency(Number(value))} ${messages.common.units.ms}`,
                        messages.dns.chartAverageLabel,
                      ]}
                      cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="response_ms" radius={[0, 4, 4, 0]}>
                      {topResults.map((resolver) => (
                        <Cell
                          key={resolver.resolver_addr}
                          fill={colorFor(resolver.resolver_addr)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {messages.dns.allResolvers}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32px]"></TableHead>
                    <SortableHead
                      label={messages.dns.headers.resolver}
                      sortKey="name"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <SortableHead
                      label={messages.dns.headers.address}
                      sortKey="addr"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                    <TableHead>{messages.dns.headers.tags}</TableHead>
                    <SortableHead
                      label={messages.dns.headers.avg}
                      sortKey="avg"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <SortableHead
                      label={messages.dns.headers.min}
                      sortKey="min"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <SortableHead
                      label={messages.dns.headers.max}
                      sortKey="max"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <SortableHead
                      label={messages.dns.headers.queries}
                      sortKey="queries"
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                    <TableHead className="text-end">
                      {messages.dns.headers.apply}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults!.map((resolver, index) => {
                    const isWinner = resolver.resolver_addr === winnerAddr
                    const resolverInfo = resolverByAddr.get(
                      resolver.resolver_addr
                    )

                    return (
                      <TableRow
                        key={resolver.resolver_addr}
                        className={
                          "transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] " +
                          (isWinner ? "winner-row" : "")
                        }
                      >
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {isWinner ? (
                            <TrophyIcon
                              weight="fill"
                              className="trophy-pop size-4 text-amber-500"
                            />
                          ) : (
                            index + 1
                          )}
                        </TableCell>
                        <TableCell
                          className={
                            "font-medium " +
                            (isWinner
                              ? "text-amber-600 dark:text-amber-400"
                              : "")
                          }
                        >
                          {getResolverLabel(resolver)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {resolver.resolver_addr}
                        </TableCell>
                        <TableCell>
                          <ResolverTags
                            info={resolverInfo}
                            gatewayLabel={messages.dns.tags.gateway}
                            currentLabel={messages.dns.tags.current}
                          />
                        </TableCell>
                        {resolver.success ? (
                          <>
                            <TableCell className="text-end font-medium tabular-nums">
                              <CountUp
                                value={resolver.response_ms}
                                formatter={formatLatency}
                              />
                              <span className="ms-1 text-xs font-normal text-muted-foreground">
                                {messages.common.units.ms}
                              </span>
                            </TableCell>
                            <TableCell className="text-end text-muted-foreground tabular-nums">
                              {formatLatency(resolver.min_ms)}
                            </TableCell>
                            <TableCell className="text-end text-muted-foreground tabular-nums">
                              {formatLatency(resolver.max_ms)}
                            </TableCell>
                            <TableCell className="text-end">
                              <Badge variant="outline" className="tabular-nums">
                                {resolver.queries_ok}/{resolver.queries_total}
                              </Badge>
                            </TableCell>
                          </>
                        ) : (
                          <TableCell
                            colSpan={4}
                            className="truncate text-end text-sm text-destructive"
                          >
                            {resolver.error ?? messages.dns.failed}
                          </TableCell>
                        )}
                        <TableCell className="text-end">
                          {resolver.resolver_kind === "gateway" ? (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={
                                !resolver.success ||
                                applyingAddr !== null ||
                                resetting ||
                                resolverInfo?.is_system === true
                              }
                              onClick={() => applyResolver(resolver)}
                              title={messages.dns.resetTitle}
                            >
                              {resolverInfo?.is_system ? null : (
                                <KeyIcon data-icon="inline-start" />
                              )}
                              {applyingAddr === resolver.resolver_addr
                                ? messages.dns.applying
                                : resolverInfo?.is_system
                                  ? messages.dns.active
                                  : messages.dns.apply}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!results && !running && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {messages.dns.emptyState}
        </div>
      )}
    </div>
  )
}
