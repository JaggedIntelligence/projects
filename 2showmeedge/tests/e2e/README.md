# End-to-End Tests

This folder contains the browser E2E layer from `TEST-SPEC.md`.

These tests use Playwright against the running Next.js app. They should prove complete user workflows, not duplicate every unit/component/API assertion.

Current coverage:

- `auth.spec.ts`: unauthenticated users are routed away from protected pages
- `tasks.spec.ts`: authenticated task create/edit/delete workflow, gated by Clerk storage state

## Install Dependencies

```sh
pnpm install
pnpm exec playwright install
```

## Run E2E Tests

Run all E2E tests:

```sh
pnpm test:e2e
```

Open Playwright UI mode:

```sh
pnpm test:e2e:ui
```

Run one spec:

```sh
pnpm exec playwright test tests/e2e/auth.spec.ts
```

## Environment

The Playwright config loads `.env.local` and `.env.test`.

Optional settings:

```sh
E2E_BASE_URL=http://127.0.0.1:3000
E2E_PORT=3000
E2E_SKIP_WEB_SERVER=1
E2E_STORAGE_STATE=tests/e2e/.auth/user.json
```

By default Playwright starts the app with:

```sh
pnpm dev -- -p 3000
```

Set `E2E_SKIP_WEB_SERVER=1` when you already have the app running.

## Clerk Authentication

The authenticated task workflow needs a saved Clerk browser session.

Recommended path:

1. Create a Clerk test user.
2. Start the app locally with `.env.local`.
3. Use Playwright UI/codegen or a small setup script later to sign in once.
4. Save the authenticated browser state to `tests/e2e/.auth/user.json`.
5. Run:

```sh
E2E_STORAGE_STATE=tests/e2e/.auth/user.json pnpm test:e2e
```

Until `E2E_STORAGE_STATE` points to an existing file, `tasks.spec.ts` is skipped by design.

## Notes

- Keep E2E tests few and high-value.
- Use component tests for local UI states.
- Use API tests for database and tRPC correctness.
- Use E2E tests for real navigation, auth boundaries, and full task workflows.
