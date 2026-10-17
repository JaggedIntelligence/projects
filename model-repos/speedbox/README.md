<div align="center">
  <img alt="Speedbox icon" src="./src-tauri/icons/64x64.png" />

  <img alt="Speedbox screenshot" src="https://github.com/user-attachments/assets/ffff9f8b-8e2c-4a7f-b08a-4ef5aed0ba2b" />

# Speedbox

</div>

Speedbox is a desktop network utility for checking how your connection actually behaves over time. It combines speed testing, DNS resolver comparison, and local history in a small Tauri app.

No accounts. No tracking. Test data stays on your machine.

👉 Download the latest version from [GitHub Releases](https://github.com/agmmnn/speedbox/releases/latest).

## Features

- **Speed test**: download, upload, ping, and jitter with a live adaptive gauge.
- **DNS resolver race**: compares public, gateway, and system DNS resolvers across multiple domains.
- **DNS actions**: apply a resolver, reset DNS to automatic, and flush the local DNS cache where supported.
- **History**: stores speed test results locally and shows recent trends.
- **Localization**: supports English, Turkish, Spanish, German, French, Portuguese (Brazil), Italian, Dutch, Polish, Japanese, Indonesian, Simplified Chinese, and Arabic (RTL layout).

<img alt="Speedbox DNS Resolver speed test" src="https://github.com/user-attachments/assets/6139e00b-d995-42be-b4c7-48d06c09fee2" />

> Browser speed tests are useful for a quick check, but they usually disappear when the tab closes. Speedbox keeps a local record so you can see whether your connection is stable, whether your ISP is under-delivering, and which DNS resolver is fastest from your network.

<img alt="Speedbox DNS Resolver speed test" src="https://github.com/user-attachments/assets/1fb8e585-858a-4d04-ba61-02680f1f7c43" />

## Tech Stack

- Tauri 2
- Vite
- shadcn/ui
- Bun
- SQLite via the Tauri backend

The app was scaffolded with [tauri-ui](https://github.com/agmmnn/tauri-ui).

## Development

- Bun
- Rust
- Tauri system prerequisites for your OS

See the official Tauri prerequisites if you are setting up a machine for the first time: https://tauri.app/start/prerequisites/

```bash
bun install
bun run tauri dev
```

Useful commands:

- `bun run dev`: frontend-only dev server
- `bun run typecheck`: TypeScript check
- `bun run build`: frontend production build
- `bun run tauri build`: desktop app build

## Notes

- Some DNS operations may require administrator privileges depending on the OS.
- DNS apply/reset support depends on the platform and the available system DNS manager.
- Speed and DNS results can vary between runs because they depend on network load, resolver behavior, routing, and server-side conditions.

## Status

Speedbox is in active development. The core speed test, DNS race, history, theme, and localization flows are implemented, with more diagnostics planned.
