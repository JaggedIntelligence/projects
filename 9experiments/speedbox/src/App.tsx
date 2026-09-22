import type { ReactNode } from "react"
import { BottomDock } from "@/components/bottom-dock"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { RouterProvider, useRouter } from "@/lib/router"
import { SpeedTestPage } from "@/pages/speed-test"
import { DnsTestPage } from "@/pages/dns-test"
import { HistoryPage } from "@/pages/history"
import { SettingsPage } from "@/pages/settings"

function PageContent() {
  const { page } = useRouter()
  return (
    <>
      <PageSlot active={page === "speed-test"}>
        <SpeedTestPage />
      </PageSlot>
      <PageSlot active={page === "dns"}>
        <DnsTestPage />
      </PageSlot>
      {/* History + Settings remount on each visit so they pick up fresh data. */}
      {page === "history" && (
        <div className="anim-enter flex flex-1 flex-col">
          <HistoryPage />
        </div>
      )}
      {page === "settings" && (
        <div className="anim-enter flex flex-1 flex-col">
          <SettingsPage />
        </div>
      )}
    </>
  )
}

function PageSlot({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <div
      aria-hidden={!active}
      className={
        active
          ? "flex flex-1 flex-col opacity-100 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          : "pointer-events-none hidden"
      }
    >
      {children}
    </div>
  )
}

export default function App() {
  return (
    <RouterProvider>
      <TooltipProvider>
        <div className="flex h-svh flex-col bg-background">
          {/* pb-24 reserves room so dock never overlaps content */}
          <main className="flex flex-1 flex-col overflow-auto pb-24">
            <PageContent />
          </main>
          <BottomDock />
        </div>
        <Toaster />
      </TooltipProvider>
    </RouterProvider>
  )
}
