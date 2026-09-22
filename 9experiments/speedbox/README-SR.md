
# Speedbox


Speedbox is a DESKTOP network utility for checking how your connection actually behaves over time. It combines speed testing, DNS resolver comparison, and local history in a small Tauri app.

No accounts. No tracking. Test data stays on your machine.

👉 Download the latest version from [GitHub Releases](https://github.com/agmmnn/speedbox/releases/latest).

## Features
 - it is NOT a  Web app
 - it is DESKTOP app for MAC and Winows, developed using Tauri-ui ( Rust Tauri based), use React.JS and VITE or NextJS frameworks
 - so we are getting best of both worlds
 - 1) DESKTOP app for Privacy Sensitive applicaiton like 'Personal Doucment Mangement app : medical , legal, real estate , finance docs ..'
 - 2) for Development using Modern React.js , Vite and Next js etc..

## How to run

- SREDDY notes:  if you use 'bun' instead of 'npm' the web screen is giving errors, GEMINI AI told use npm

```bash
npm install
npm run tauri dev
```

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
