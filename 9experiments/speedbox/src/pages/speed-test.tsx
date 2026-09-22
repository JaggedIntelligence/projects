import { useState, useEffect, useRef } from "react"
import { listen } from "@tauri-apps/api/event"
import { useSpring } from "framer-motion"
import { trackedInvoke } from "@/lib/tauri"
import { useI18n } from "@/i18n"
import { JuicyButton } from "@/components/ui/juicy-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CountUp } from "@/components/ui/count-up"
import { DigitRoll } from "@/components/ui/digit-roll"
import {
  ArrowFatLinesDownIcon,
  ArrowFatLinesUpIcon,
  WifiHighIcon,
  WaveformIcon,
} from "@phosphor-icons/react"

interface ProgressPayload {
  phase: "ping" | "download" | "upload" | "done"
  current_mbps: number | null
  current_ms: number | null
  progress: number
}

export interface SpeedResult {
  download_mbps: number
  upload_mbps: number
  ping_ms: number
  jitter_ms: number
  timestamp: number
}

// Gauge geometry
const CX = 140
const CY = 140
const R = 108
const START_ANGLE = 225
const SWEEP = 270
const ARC_LENGTH = (SWEEP / 360) * 2 * Math.PI * R

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, endDeg)
  const sweep = endDeg - startDeg
  const large = sweep > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

const TRACK_PATH = arcPath(CX, CY, R, START_ANGLE, START_ANGLE + SWEEP)

const PHASE_COLORS: Record<string, string> = {
  "": "var(--color-primary)",
  ping: "var(--color-chart-1)",
  download: "var(--color-chart-2)",
  upload: "var(--color-chart-4)",
  done: "var(--color-chart-2)",
}

const SPEED_GAUGE_MAX_STEPS = [
  50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000,
]
const PING_GAUGE_MAX_STEPS = [75, 100, 150, 200, 300, 500]
const MOCK_SPEED_PROFILES = [
  { label: "12 Mbps", download: 12, upload: 3, ping: 58, jitter: 14 },
  { label: "45 Mbps", download: 45, upload: 9, ping: 31, jitter: 6 },
  { label: "120 Mbps", download: 120, upload: 24, ping: 18, jitter: 4 },
  { label: "500 Mbps", download: 500, upload: 95, ping: 9, jitter: 2 },
  { label: "940 Mbps", download: 940, upload: 420, ping: 4, jitter: 1 },
] as const

function getAdaptiveMbpsMax(value: number) {
  const target = Math.max(value * 1.35, 75)
  return SPEED_GAUGE_MAX_STEPS.find((step) => step >= target) ?? 2500
}

function getAdaptivePingMax(value: number) {
  const target = Math.max(value * 1.35, 75)
  return PING_GAUGE_MAX_STEPS.find((step) => step >= target) ?? 750
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

interface GaugeProps {
  value: number
  max: number
  phase: string
  phaseLabel: string
  running: boolean
  ariaLabel: string
}

function SpeedGauge({
  value,
  max,
  phase,
  phaseLabel,
  running,
  ariaLabel,
}: GaugeProps) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const angle = START_ANGLE + pct * SWEEP
  const dashOffset = ARC_LENGTH * (1 - pct)
  const color = PHASE_COLORS[phase] ?? PHASE_COLORS[""]

  const needleRef = useRef<SVGGElement>(null)
  const angleSpring = useSpring(angle, {
    stiffness: 120,
    damping: 14,
    mass: 0.9,
  })
  useEffect(() => {
    angleSpring.set(angle)
  }, [angle, angleSpring])
  useEffect(() => {
    return angleSpring.on("change", (a) => {
      needleRef.current?.setAttribute("transform", `rotate(${a} ${CX} ${CY})`)
    })
  }, [angleSpring])

  const majorTicks = [0, 0.25, 0.5, 0.75, 1]
  const minorTicks = Array.from({ length: 21 }, (_, i) => i / 20).filter(
    (t) => !majorTicks.includes(t)
  )

  return (
    <svg
      viewBox="0 0 280 260"
      className="h-auto w-full"
      style={{ overflow: "visible" }}
      aria-label={ariaLabel}
    >
      {minorTicks.map((t) => {
        const deg = START_ANGLE + t * SWEEP
        const p1 = polarToCartesian(CX, CY, R + 6, deg)
        const p2 = polarToCartesian(CX, CY, R + 12, deg)
        return (
          <line
            key={`minor-${t}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            className="stroke-muted-foreground/30"
            strokeWidth={1}
          />
        )
      })}
      {majorTicks.map((t) => {
        const deg = START_ANGLE + t * SWEEP
        const p1 = polarToCartesian(CX, CY, R + 4, deg)
        const p2 = polarToCartesian(CX, CY, R + 14, deg)
        const pl = polarToCartesian(CX, CY, R + 26, deg)
        const label = Math.round(max * t).toString()
        return (
          <g key={`major-${t}`}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className="stroke-muted-foreground/60"
              strokeWidth={2}
            />
            <text
              x={pl.x}
              y={pl.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {label}
            </text>
          </g>
        )
      })}

      <path
        d={TRACK_PATH}
        fill="none"
        strokeWidth={14}
        strokeLinecap="round"
        className="stroke-muted"
      />
      <path
        d={TRACK_PATH}
        fill="none"
        strokeWidth={14}
        strokeLinecap="round"
        style={{
          stroke: color,
          strokeDasharray: `${ARC_LENGTH.toFixed(2)} 1000`,
          strokeDashoffset: dashOffset.toFixed(2),
          transition:
            "stroke-dashoffset 300ms cubic-bezier(0.23,1,0.32,1), stroke 400ms ease",
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />

      <g ref={needleRef} transform={`rotate(${START_ANGLE} ${CX} ${CY})`}>
        <polygon
          points={`${CX - 3.5},${CY + 6} ${CX + 3.5},${CY + 6} ${CX + 1},${CY - R + 18} ${CX - 1},${CY - R + 18}`}
          style={{ fill: color, filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </g>

      <circle
        cx={CX}
        cy={CY}
        r={10}
        className="fill-background"
        stroke={color}
        strokeWidth={3}
        style={{
          transition: "stroke 400ms ease",
          filter: running ? `drop-shadow(0 0 6px ${color})` : "none",
        }}
      />
      <circle cx={CX} cy={CY} r={3} style={{ fill: color }} />

      <text
        x={CX}
        y={CY - 36}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 700 }}
      >
        {phaseLabel}
      </text>
    </svg>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number | null
  unit: string
  valueFormatter?: (value: number) => string
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  valueFormatter,
}: MetricCardProps) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0.5">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <span className="font-heading text-[1.7rem] font-bold tabular-nums">
          {value === null ? (
            "—"
          ) : (
            <CountUp value={value} formatter={valueFormatter} />
          )}
        </span>
        <span className="ms-1 text-xs text-muted-foreground">{unit}</span>
      </CardContent>
    </Card>
  )
}

export function SpeedTestPage() {
  const { messages, formatNumber } = useI18n()
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<string>("")
  const [gaugeValue, setGaugeValue] = useState(0)
  const [gaugeMax, setGaugeMax] = useState(75)
  const [gaugeUnit, setGaugeUnit] = useState<"mbps" | "ms">("mbps")
  const [result, setResult] = useState<SpeedResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mockPanelOpen, setMockPanelOpen] = useState(false)
  const speedScalePhaseRef = useRef<"download" | "upload" | null>(null)
  const mockTimeoutsRef = useRef<number[]>([])

  const clearMockRun = () => {
    for (const timeoutId of mockTimeoutsRef.current) {
      window.clearTimeout(timeoutId)
    }

    mockTimeoutsRef.current = []
  }

  useEffect(() => {
    const unlisten = listen<ProgressPayload>("speed-test-progress", (e) => {
      const p = e.payload
      setPhase(p.phase)
      if (p.phase === "ping" && p.current_ms !== null) {
        speedScalePhaseRef.current = null
        setGaugeValue(p.current_ms)
        setGaugeMax(getAdaptivePingMax(p.current_ms))
        setGaugeUnit("ms")
      } else if (
        (p.phase === "download" || p.phase === "upload") &&
        p.current_mbps !== null
      ) {
        const speedPhase = p.phase
        const nextMax = getAdaptiveMbpsMax(p.current_mbps)
        setGaugeValue(p.current_mbps)
        setGaugeMax((currentMax) => {
          if (speedScalePhaseRef.current !== speedPhase) {
            speedScalePhaseRef.current = speedPhase
            return nextMax
          }

          return Math.max(currentMax, nextMax)
        })
        setGaugeUnit("mbps")
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isTypingTarget(event.target)
      ) {
        return
      }

      if (
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.altKey
      ) {
        return
      }

      if (event.key.toLowerCase() !== "m") {
        return
      }

      event.preventDefault()
      setMockPanelOpen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      clearMockRun()
    }
  }, [])

  const runTest = async () => {
    clearMockRun()
    setRunning(true)
    setResult(null)
    setError(null)
    setGaugeValue(0)
    setGaugeMax(75)
    setGaugeUnit("mbps")
    speedScalePhaseRef.current = null
    setPhase("ping")

    try {
      const res = await trackedInvoke<SpeedResult>("start_speed_test")
      setResult(res)
      setGaugeValue(res.download_mbps)
      setGaugeMax(getAdaptiveMbpsMax(res.download_mbps))
      setGaugeUnit("mbps")
      setPhase("done")
    } catch (e) {
      setError(String(e))
      setPhase("")
    } finally {
      setRunning(false)
    }
  }

  const scheduleMockStep = (delay: number, run: () => void) => {
    const timeoutId = window.setTimeout(run, delay)
    mockTimeoutsRef.current.push(timeoutId)
  }

  const runMockTest = (profile: (typeof MOCK_SPEED_PROFILES)[number]) => {
    clearMockRun()
    setRunning(true)
    setResult(null)
    setError(null)
    setGaugeValue(0)
    setGaugeMax(75)
    setGaugeUnit("ms")
    setPhase("ping")
    speedScalePhaseRef.current = null

    scheduleMockStep(120, () => {
      setGaugeValue(profile.ping)
      setGaugeMax(getAdaptivePingMax(profile.ping))
      setGaugeUnit("ms")
      setPhase("ping")
    })

    for (let step = 1; step <= 8; step++) {
      scheduleMockStep(240 + step * 70, () => {
        const progress = step / 8
        const value = profile.download * (0.18 + progress * 0.82)
        setGaugeValue(value)
        setGaugeMax((currentMax) =>
          Math.max(currentMax, getAdaptiveMbpsMax(value))
        )
        setGaugeUnit("mbps")
        setPhase("download")
        speedScalePhaseRef.current = "download"
      })
    }

    for (let step = 1; step <= 8; step++) {
      scheduleMockStep(940 + step * 70, () => {
        const progress = step / 8
        const value = profile.upload * (0.2 + progress * 0.8)
        setGaugeValue(value)
        setGaugeMax((currentMax) => {
          const nextMax = getAdaptiveMbpsMax(value)
          return speedScalePhaseRef.current === "upload"
            ? Math.max(currentMax, nextMax)
            : nextMax
        })
        setGaugeUnit("mbps")
        setPhase("upload")
        speedScalePhaseRef.current = "upload"
      })
    }

    scheduleMockStep(1600, () => {
      const mockResult: SpeedResult = {
        download_mbps: profile.download,
        upload_mbps: profile.upload,
        ping_ms: profile.ping,
        jitter_ms: profile.jitter,
        timestamp: Math.floor(Date.now() / 1000),
      }

      setResult(mockResult)
      setGaugeValue(profile.download)
      setGaugeMax(getAdaptiveMbpsMax(profile.download))
      setGaugeUnit("mbps")
      setPhase("done")
      setRunning(false)
      speedScalePhaseRef.current = null
      mockTimeoutsRef.current = []
    })
  }

  const displayDecimals = gaugeValue < 10 ? 1 : 0
  const color = PHASE_COLORS[phase] ?? PHASE_COLORS[""]
  const gaugeUnitLabel = messages.common.units[gaugeUnit]
  const phaseLabels: Record<string, string> = {
    "": messages.speed.phases.ready,
    ping: messages.speed.phases.ping,
    download: messages.speed.phases.download,
    upload: messages.speed.phases.upload,
    done: messages.speed.phases.done,
  }
  const formatMetricValue = (value: number) => {
    const decimals = value < 10 ? 1 : 0
    return formatNumber(value, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  const formatGaugeValue = (value: number) =>
    formatNumber(value, {
      minimumFractionDigits: displayDecimals,
      maximumFractionDigits: displayDecimals,
    })

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-6">
      {import.meta.env.DEV && mockPanelOpen ? (
        <div className="fixed top-4 right-4 z-50 w-64 rounded-xl border border-border/60 bg-background/90 p-3 text-foreground shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold">Mock speed test</div>
              <div className="text-[10px] text-muted-foreground">
                Cmd/Ctrl+Shift+M
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setMockPanelOpen(false)}
              aria-label="Close mock speed panel"
            >
              x
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {MOCK_SPEED_PROFILES.map((profile) => (
              <Button
                key={profile.label}
                type="button"
                variant="outline"
                size="xs"
                disabled={running}
                onClick={() => runMockTest(profile)}
              >
                {profile.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid w-full max-w-4xl grid-cols-[1fr_minmax(220px,300px)_1fr] items-center gap-5">
        {/* Left: Download + Ping */}
        <div
          key={result ? result.timestamp : "pending"}
          className="anim-stagger flex flex-col gap-3"
        >
          <MetricCard
            icon={<ArrowFatLinesDownIcon className="size-4" />}
            label={messages.speed.metrics.download}
            value={result?.download_mbps ?? null}
            unit={messages.common.units.mbps}
            valueFormatter={formatMetricValue}
          />
          <MetricCard
            icon={<WifiHighIcon className="size-4" />}
            label={messages.speed.metrics.ping}
            value={result?.ping_ms ?? null}
            unit={messages.common.units.ms}
            valueFormatter={formatMetricValue}
          />
        </div>

        {/* Center: Gauge + Odometer + Button */}
        <div className="flex flex-col items-center gap-3.5">
          <div className="relative w-full">
            <SpeedGauge
              value={gaugeValue}
              max={gaugeMax}
              phase={phase}
              phaseLabel={phaseLabels[phase] ?? phase.toUpperCase()}
              running={running}
              ariaLabel={messages.speed.gaugeAria(
                formatGaugeValue(gaugeValue),
                gaugeUnitLabel
              )}
            />
            {/* Odometer — positioned at gauge hub */}
            <div className="pointer-events-none absolute inset-x-0 top-[62%] flex justify-center">
              <div
                className="flex items-center gap-1.5 rounded-[4px] border border-black/60 bg-zinc-950 px-2 py-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
                style={{ color }}
              >
                <DigitRoll
                  value={gaugeValue}
                  decimals={displayDecimals}
                  size={22}
                  className="font-mono font-bold tracking-[0.08em] tabular-nums"
                  formatter={formatGaugeValue}
                />
                <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                  {gaugeUnitLabel}
                </span>
              </div>
            </div>
          </div>

          <JuicyButton
            size="lg"
            className="w-36"
            onClick={runTest}
            disabled={running}
          >
            {running
              ? messages.speed.testing
              : result
                ? messages.speed.again
                : messages.speed.start}
          </JuicyButton>
          {error && (
            <p className="max-w-sm text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Right: Upload + Jitter */}
        <div
          key={result ? `${result.timestamp}-r` : "pending-r"}
          className="anim-stagger flex flex-col gap-3"
        >
          <MetricCard
            icon={<ArrowFatLinesUpIcon className="size-4" />}
            label={messages.speed.metrics.upload}
            value={result?.upload_mbps ?? null}
            unit={messages.common.units.mbps}
            valueFormatter={formatMetricValue}
          />
          <MetricCard
            icon={<WaveformIcon className="size-4" />}
            label={messages.speed.metrics.jitter}
            value={result?.jitter_ms ?? null}
            unit={messages.common.units.ms}
            valueFormatter={formatMetricValue}
          />
        </div>
      </div>
    </div>
  )
}
