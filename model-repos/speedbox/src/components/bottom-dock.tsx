import { motion } from "framer-motion"
import {
  GaugeIcon,
  GlobeIcon,
  ClockCounterClockwiseIcon,
  GearSixIcon,
} from "@phosphor-icons/react"

import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"
import { useRouter, type Page } from "@/lib/router"

interface DockItem {
  id: Page
  Icon: React.ComponentType<{ className?: string; weight?: "regular" | "fill" }>
}

const ITEMS: DockItem[] = [
  { id: "speed-test", Icon: GaugeIcon },
  { id: "dns", Icon: GlobeIcon },
  { id: "history", Icon: ClockCounterClockwiseIcon },
  { id: "settings", Icon: GearSixIcon },
]

export function BottomDock() {
  const { page, navigate } = useRouter()
  const { messages } = useI18n()

  const labels: Record<Page, string> = {
    "speed-test": messages.nav.speed,
    dns: messages.nav.dns,
    history: messages.nav.history,
    settings: messages.nav.settings,
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
      <motion.nav
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.1 }}
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl"
        aria-label={messages.nav.primaryAria}
      >
        {ITEMS.map((item) => {
          const active = page === item.id
          const label = labels[item.id]
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              {active && (
                <motion.span
                  layoutId="dock-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.Icon
                className="size-4 shrink-0"
                weight={active ? "fill" : "regular"}
              />
              <motion.span
                initial={false}
                animate={{
                  width: active ? "auto" : 0,
                  opacity: active ? 1 : 0,
                  marginInlineStart: active ? 0 : -4,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {label}
              </motion.span>
            </motion.button>
          )
        })}
      </motion.nav>
    </div>
  )
}
