export interface Messages {
  nav: {
    primaryAria: string
    speed: string
    dns: string
    history: string
    settings: string
  }
  common: {
    units: {
      mbps: string
      ms: string
    }
    theme: {
      system: string
      light: string
      dark: string
    }
  }
  settings: {
    title: string
    description: string
    appearanceTitle: string
    themeLabel: string
    localeTitle: string
    localeLabel: string
    localeDescription: string
    dnsHostsTitle: string
    dnsHostsDescription: string
    restoreDefaults: string
    restoreDefaultsTitle: string
    noHosts: string
    addHostPlaceholder: string
    addHost: string
    removeHost: (host: string) => string
    duplicateHost: (host: string) => string
    defaultHostsRestored: string
  }
  speed: {
    metrics: {
      download: string
      upload: string
      ping: string
      jitter: string
    }
    phases: {
      ready: string
      ping: string
      download: string
      upload: string
      done: string
    }
    start: string
    testing: string
    again: string
    gaugeAria: (value: string, unit: string) => string
  }
  dns: {
    title: string
    summary: (resolverCount: number, queryCount: number) => string
    emptySummary: (queryCount: number) => string
    flushCache: string
    flushingCache: string
    flushCacheTitle: string
    resetToAuto: string
    resetting: string
    resetTitle: string
    start: string
    again: string
    cancel: string
    cancelling: string
    emptyState: string
    progressPending: string
    topAverage: (count: number) => string
    chartAverageLabel: string
    allResolvers: string
    headers: {
      resolver: string
      address: string
      tags: string
      avg: string
      min: string
      max: string
      queries: string
      apply: string
    }
    tags: {
      gateway: string
      current: string
    }
    apply: string
    applying: string
    active: string
    failed: string
    routerGateway: string
    systemDns: string
    systemDnsNumber: (index: number) => string
    restoringAutomatic: string
    resetAutomaticRouterSuccess: string
    applyingResolver: (label: string, addrs: string) => string
    applySuccess: (label: string) => string
    resettingAutomatic: string
    resetAutomaticDhcpSuccess: string
    flushingDnsCache: string
    dnsCacheFlushed: string
    failedWith: (error: string) => string
  }
  history: {
    loading: string
    emptyTitle: string
    emptyDescription: string
    title: string
    clearAll: string
    clearing: string
    clearAllTitle: string
    confirmClearAll: (count: number) => string
    entryRemoved: string
    failedToRemove: (error: string) => string
    cleared: string
    failedToClear: (error: string) => string
    avgDownload: string
    avgUpload: string
    avgPing: string
    speedOverTime: string
    recentTests: string
    chartDownload: string
    chartUpload: string
    chartPing: string
    headers: {
      date: string
      download: string
      upload: string
      ping: string
      jitter: string
    }
    removeEntry: string
  }
}

export const en: Messages = {
  nav: {
    primaryAria: "Primary navigation",
    speed: "Speed",
    dns: "DNS",
    history: "History",
    settings: "Settings",
  },
  common: {
    units: {
      mbps: "Mbps",
      ms: "ms",
    },
    theme: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
  },
  settings: {
    title: "Settings",
    description: "Appearance, language, and DNS test configuration.",
    appearanceTitle: "Appearance",
    themeLabel: "Theme",
    localeTitle: "Language",
    localeLabel: "Interface language",
    localeDescription: "Choose the language used throughout the app.",
    dnsHostsTitle: "DNS Test Hosts",
    dnsHostsDescription:
      "Domains queried against each resolver during a race. Different hosts help bypass resolver-side caching.",
    restoreDefaults: "Defaults",
    restoreDefaultsTitle: "Restore default hosts",
    noHosts: "No hosts. Add one below or restore the defaults.",
    addHostPlaceholder: "example.com",
    addHost: "Add",
    removeHost: (host: string) => `Remove ${host}`,
    duplicateHost: (host: string) => `${host} is already in the list`,
    defaultHostsRestored: "Default hosts restored",
  },
  speed: {
    metrics: {
      download: "Download",
      upload: "Upload",
      ping: "Ping",
      jitter: "Jitter",
    },
    phases: {
      ready: "READY",
      ping: "PING",
      download: "DOWNLOAD",
      upload: "UPLOAD",
      done: "DONE",
    },
    start: "Start Test",
    testing: "Testing...",
    again: "Test Again",
    gaugeAria: (value: string, unit: string) => `${value} ${unit}`,
  },
  dns: {
    title: "DNS Resolver Race",
    summary: (resolverCount: number, queryCount: number) =>
      `${resolverCount} resolvers · ${queryCount} queries each`,
    emptySummary: (queryCount: number) =>
      `${queryCount} queries per resolver across different domains`,
    flushCache: "Flush Cache",
    flushingCache: "Flushing...",
    flushCacheTitle: "Clear local DNS cache (may require admin on macOS)",
    resetToAuto: "Reset to Auto",
    resetting: "Resetting...",
    resetTitle: "Requires administrator password",
    start: "Start Race",
    again: "Race Again",
    cancel: "Cancel",
    cancelling: "Cancelling...",
    emptyState: 'Click "Start Race" to compare resolver speeds',
    progressPending: "...",
    topAverage: (count: number) => `Top ${count} - Average Response Time`,
    chartAverageLabel: "Avg",
    allResolvers: "All Resolvers",
    headers: {
      resolver: "Resolver",
      address: "Address",
      tags: "Tags",
      avg: "Avg",
      min: "Min",
      max: "Max",
      queries: "Queries",
      apply: "Apply",
    },
    tags: {
      gateway: "Gateway",
      current: "Current",
    },
    apply: "Apply",
    applying: "Applying...",
    active: "Active",
    failed: "Failed",
    routerGateway: "Router (Gateway)",
    systemDns: "System DNS",
    systemDnsNumber: (index: number) => `System DNS #${index}`,
    restoringAutomatic: "Restoring automatic DNS...",
    resetAutomaticRouterSuccess: "DNS reset to automatic (router / DHCP)",
    applyingResolver: (label: string, addrs: string) =>
      `Applying ${label} (${addrs})...`,
    applySuccess: (label: string) => `System DNS set to ${label}`,
    resettingAutomatic: "Resetting DNS to automatic...",
    resetAutomaticDhcpSuccess: "DNS reset to automatic (DHCP)",
    flushingDnsCache: "Flushing DNS cache...",
    dnsCacheFlushed: "DNS cache flushed",
    failedWith: (error: string) => `Failed: ${error}`,
  },
  history: {
    loading: "Loading history...",
    emptyTitle: "No tests yet",
    emptyDescription: "Run a speed test to start tracking your history",
    title: "History",
    clearAll: "Clear All",
    clearing: "Clearing...",
    clearAllTitle: "Remove all history entries",
    confirmClearAll: (count: number) =>
      `Remove all ${count} history entries? This cannot be undone.`,
    entryRemoved: "Entry removed",
    failedToRemove: (error: string) => `Failed to remove: ${error}`,
    cleared: "History cleared",
    failedToClear: (error: string) => `Failed to clear: ${error}`,
    avgDownload: "Avg Download",
    avgUpload: "Avg Upload",
    avgPing: "Avg Ping",
    speedOverTime: "Speed Over Time",
    recentTests: "Recent Tests",
    chartDownload: "Download (Mbps)",
    chartUpload: "Upload (Mbps)",
    chartPing: "Ping (ms)",
    headers: {
      date: "Date",
      download: "Download",
      upload: "Upload",
      ping: "Ping",
      jitter: "Jitter",
    },
    removeEntry: "Remove entry",
  },
}
