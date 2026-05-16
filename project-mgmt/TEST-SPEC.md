# Automated Test Suite Plan

This project is a Next.js 14 App Router web app with React 18 client components, tRPC v10, Drizzle/Postgres, Clerk auth, Zustand state, Tailwind/Radix UI, and Vitest already installed.

The goal is to build the test suite in layers so fast checks catch simple regressions, integration tests prove business/data behavior, and E2E tests verify the real user workflows.

## Recommended Testing Layers

### 1. Static Safety Suite

Use these as the cheapest first gate:

- TypeScript: `tsc --noEmit`
- Next build: `next build`
- ESLint, after confirming the current Next.js lint setup for this project

Suggested scripts:

```json
{
  "typecheck": "tsc --noEmit",
  "test:build": "next build"
}
```

### 2. Unit Tests

Use Vitest for fast, focused tests.

Best targets in this repo:

- `lib/validators.ts`
- `store/task-store.ts`
- pure helpers such as `lib/utils.ts`
- extracted date/status/priority helpers, if added later

Example coverage:

- Task title is required.
- Task title max length is enforced.
- `dueDate` is coerced correctly.
- Update/delete schemas require UUIDs.
- Store opens/closes the editor correctly.
- Filters reset correctly.

These should be fast enough to run on every commit.

### 3. API / tRPC Integration Tests

Because the app uses tRPC, the API suite should start by testing procedures through typed server callers rather than raw HTTP requests to `/api/trpc`.

Best targets:

- `tasks.list`
- `tasks.create`
- `tasks.update`
- `tasks.delete`
- auth enforcement through `protectedProcedure`
- user isolation: user A cannot see, update, or delete user B's tasks
- filters: status, priority, search
- ordering by `createdAt desc`

Architecture choice:

- Use a dedicated test Postgres database.
- Run Drizzle migrations before API tests.
- Clear task tables between tests.
- Avoid mocking Drizzle for these tests; the value is proving schema, queries, and tRPC behavior together.

### 4. Frontend Component Tests

Use Vitest with React Testing Library first.

Recommended packages:

- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `msw`, later if API mocking becomes useful

Best targets:

- `TaskFilters`
- `TaskEditor`
- `TaskList` loading/error/empty/list states
- form validation
- save button pending state
- edit mode pre-fills an existing task

Because some components are tightly coupled to `api.tasks.*` hooks, there are two options:

- Mock the tRPC hooks in component tests.
- Test fewer internals here and push full behavior to Playwright.

Preferred approach: use component tests for UI state and form behavior, but avoid over-mocking tRPC into a fake version of the app.

### 5. End-to-End Tests

Use Playwright for E2E tests.

Best first E2E flows:

- authenticated user can open the Tasks page
- create task
- edit task
- change status
- filter by status, priority, and search
- delete task
- empty state appears
- unauthorized user redirects to sign-in

Auth is the tricky part because the app uses Clerk. Handle it deliberately:

- Use Clerk test mode/test users if available for this setup.
- Or mock/bypass auth only in a dedicated test environment.
- Avoid brittle UI login automation unless absolutely needed.

### 6. Optional Later: Real-Browser Component Tests

Vitest Browser Mode can run component tests natively in a browser and can use Playwright as the provider for CI/local automation.

Do not start here. Add it later if Radix UI, popover, dialog, or calendar behavior becomes painful under jsdom.

### 7. Optional Later: Accessibility and Visual Checks

Add these after core behavior is stable.

Potential tools:

- `@axe-core/playwright` for accessibility smoke tests
- Playwright screenshots for stable pages/components

Avoid broad visual snapshot coverage early because it can become noisy.

## Suggested Test Folder Structure

```text
tests/
  unit/
    validators.test.ts
    task-store.test.ts

  api/
    tasks-router.test.ts
    auth.test.ts

  components/
    task-filters.test.tsx
    task-editor.test.tsx
    task-list.test.tsx

  e2e/
    tasks.spec.ts
    auth.spec.ts

  helpers/
    test-db.ts
    trpc-caller.ts
    render.tsx
    factories.ts
```

## Suggested Scripts

```json
{
  "test": "vitest",
  "test:unit": "vitest run tests/unit",
  "test:api": "vitest run tests/api",
  "test:components": "vitest run tests/components",
  "test:e2e": "playwright test",
  "test:all": "pnpm typecheck && pnpm test:unit && pnpm test:api && pnpm test:components && pnpm test:e2e"
}
```

## Implementation Order

1. Add Vitest config and setup file.
2. Add unit tests for validators and Zustand store.
3. Add test database helper.
4. Add tRPC caller tests for the tasks router.
5. Add React Testing Library tests for filters, editor, and list states.
6. Add Playwright with one happy-path task flow.
7. Add CI pipeline split into fast tests and slower E2E tests.

## Guiding Principle

Do not make E2E tests carry the whole quality burden.

Put business/database correctness in tRPC integration tests, UI state in component tests, and reserve Playwright for proving that the real app works like a user expects.
