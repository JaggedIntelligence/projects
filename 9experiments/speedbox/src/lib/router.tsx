import { createContext, useContext, useState } from "react"

export type Page = "speed-test" | "dns" | "history" | "settings"

interface RouterContextValue {
  page: Page
  navigate: (page: Page) => void
}

const RouterContext = createContext<RouterContextValue>({
  page: "speed-test",
  navigate: () => {},
})

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState<Page>("speed-test")
  return (
    <RouterContext.Provider value={{ page, navigate: setPage }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  return useContext(RouterContext)
}
