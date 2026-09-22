import { useState, useEffect } from "react"
import { trackedInvoke } from "@/lib/tauri"
import { useI18n } from "@/i18n"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrashIcon, TrashSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { SpeedResult } from "./speed-test"

export function HistoryPage() {
  const { messages, formatDate, formatNumber } = useI18n()
  const [history, setHistory] = useState<SpeedResult[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingTs, setDeletingTs] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)

  const load = () => {
    trackedInvoke<SpeedResult[]>("get_speed_history")
      .then((data) => setHistory(data.reverse()))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deleteOne = async (r: SpeedResult) => {
    // Optimistic removal; rollback on failure.
    const snapshot = history
    setDeletingTs(r.timestamp)
    setHistory((prev) => prev.filter((x) => x.timestamp !== r.timestamp))
    try {
      await trackedInvoke("delete_speed_result", { timestamp: r.timestamp })
      toast.success(messages.history.entryRemoved)
    } catch (e) {
      setHistory(snapshot)
      toast.error(messages.history.failedToRemove(String(e)))
    } finally {
      setDeletingTs(null)
    }
  }

  const clearAll = async () => {
    if (history.length === 0) return
    const ok = window.confirm(messages.history.confirmClearAll(history.length))
    if (!ok) return
    setClearing(true)
    const snapshot = history
    setHistory([])
    try {
      await trackedInvoke("clear_speed_history")
      toast.success(messages.history.cleared)
    } catch (e) {
      setHistory(snapshot)
      toast.error(messages.history.failedToClear(String(e)))
    } finally {
      setClearing(false)
    }
  }

  const formatHistoryDate = (timestamp: number) =>
    formatDate(timestamp * 1000, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const formatShortHistoryDate = (timestamp: number) =>
    formatDate(timestamp * 1000, {
      month: "short",
      day: "numeric",
    })

  const formatMetricValue = (value: number, fractionDigits = 1) =>
    formatNumber(value, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {messages.history.loading}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p className="text-base font-medium">{messages.history.emptyTitle}</p>
        <p>{messages.history.emptyDescription}</p>
      </div>
    )
  }

  const chartData = history.map((r) => ({
    date: formatShortHistoryDate(r.timestamp),
    download: Math.round(r.download_mbps),
    upload: Math.round(r.upload_mbps),
    ping: Math.round(r.ping_ms),
  }))

  const avgDownload =
    history.reduce((s, r) => s + r.download_mbps, 0) / history.length
  const avgUpload =
    history.reduce((s, r) => s + r.upload_mbps, 0) / history.length
  const avgPing = history.reduce((s, r) => s + r.ping_ms, 0) / history.length

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8 lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-balance">
          {messages.history.title}
        </h2>
        <Button
          variant="outline"
          onClick={clearAll}
          disabled={clearing || history.length === 0}
          title={messages.history.clearAllTitle}
        >
          <TrashSimpleIcon data-icon="inline-start" />
          {clearing ? messages.history.clearing : messages.history.clearAll}
        </Button>
      </div>

      <div className="anim-stagger grid grid-cols-3 gap-4">
        {[
          {
            label: messages.history.avgDownload,
            value: avgDownload,
            unit: messages.common.units.mbps,
          },
          {
            label: messages.history.avgUpload,
            value: avgUpload,
            unit: messages.common.units.mbps,
          },
          {
            label: messages.history.avgPing,
            value: avgPing,
            unit: messages.common.units.ms,
          },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <span className="font-heading text-2xl font-bold tabular-nums">
                {formatMetricValue(m.value)}
              </span>
              <span className="ms-1 text-sm text-muted-foreground">
                {m.unit}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.history.speedOverTime}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatNumber(Number(value)),
                  String(name),
                ]}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="download"
                name={messages.history.chartDownload}
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="upload"
                name={messages.history.chartUpload}
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="ping"
                name={messages.history.chartPing}
                stroke="var(--color-chart-4)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.history.recentTests}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {messages.history.headers.date}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {messages.history.headers.download}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {messages.history.headers.upload}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {messages.history.headers.ping}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                    {messages.history.headers.jitter}
                  </th>
                  <th className="w-10 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {history
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((r) => (
                    <tr
                      key={r.timestamp}
                      className="border-b transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatHistoryDate(r.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                        {formatMetricValue(r.download_mbps)}
                        <span className="ms-1 text-xs text-muted-foreground">
                          {messages.common.units.mbps}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                        {formatMetricValue(r.upload_mbps)}
                        <span className="ms-1 text-xs text-muted-foreground">
                          {messages.common.units.mbps}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                        {formatMetricValue(r.ping_ms)}
                        <span className="ms-1 text-xs text-muted-foreground">
                          {messages.common.units.ms}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                        {formatMetricValue(r.jitter_ms)}
                        <span className="ms-1 text-xs text-muted-foreground">
                          {messages.common.units.ms}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteOne(r)}
                          disabled={deletingTs === r.timestamp}
                          aria-label={messages.history.removeEntry}
                          title={messages.history.removeEntry}
                        >
                          <TrashIcon />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
