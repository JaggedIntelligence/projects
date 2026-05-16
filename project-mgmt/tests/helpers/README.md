# Test Helpers

Shared helpers for the automated test suite.

Current helpers:

- `api-test-harness.ts`: API/tRPC integration-test setup, typed caller creation, test DB guard, and task cleanup
- `render.tsx`: React Testing Library render helper and Zustand task-store reset
- `e2e.ts`: Playwright task workflow helpers and Clerk storage-state detection

## Guidelines

- Keep helpers small and specific to a test layer.
- Prefer readable test code over hiding every action behind helpers.
- Do not put assertions for business behavior in helpers unless they are generic UI synchronization checks.
- Keep database setup in API helpers, not component or E2E helpers.
- Keep full browser workflow helpers in E2E helpers, not component helpers.

## Auth Storage

Playwright authenticated tests can use a saved Clerk session via:

```sh
E2E_STORAGE_STATE=tests/e2e/.auth/user.json pnpm test:e2e
```

The `tests/e2e/.auth` folder is ignored by git because it may contain local session data.
