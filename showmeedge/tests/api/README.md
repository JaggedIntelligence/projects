# API / tRPC Integration Tests

This folder contains the API integration-test layer from `TEST-SPEC.md`.

These tests call the tRPC router through typed server callers. They do not drive the browser and they do not call `/api/trpc` over HTTP.

Current coverage:

- `auth.test.ts`: protected tRPC procedures reject unauthenticated callers
- `tasks-router.test.ts`: task create/list/update/delete behavior, filtering, ordering, and user isolation

## Test Database

Use a dedicated test database. Do not point these tests at a database that contains data you care about because the helpers clear the `tasks` table between tests.

Create `.env.test` from the example:

```sh
cp .env.test.example .env.test
```

Then set:

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/second_brain_test
```

The tests copy `TEST_DATABASE_URL` into `DATABASE_URL` before importing the app database module, because `server/db/index.ts` creates the Drizzle client at import time.

## Run API Tests

Run the API suite once:

```sh
pnpm test:api
```

Run one file:

```sh
pnpm vitest run tests/api/tasks-router.test.ts
```

If `TEST_DATABASE_URL` is not configured, these tests are skipped so normal unit-test runs do not accidentally touch a development database.

## Database Setup

Before running these tests, make sure the test database exists and has the project schema applied.

One simple local approach:

```sh
createdb second_brain_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/second_brain_test pnpm db:migrate
pnpm test:api
```

If you prefer using `db/init.sql`, apply that file to the test database instead of running migrations.
