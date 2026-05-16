# Unit Tests

This folder contains the fast unit-test layer from `TEST-SPEC.md`.

Current coverage:

- `validators.test.ts`: task schema validation and coercion behavior
- `task-store.test.ts`: Zustand task UI state behavior

## Run Unit Tests

Run the unit suite once:

```sh
pnpm test:unit
```

Run the unit suite in watch mode while editing:

```sh
pnpm test:unit:watch
```

Run all Vitest tests:

```sh
pnpm test
```

## Notes

- These tests should stay fast and isolated.
- Prefer testing pure validation, state transitions, and helper behavior here.
- Put database/tRPC behavior in `tests/api`.
- Put real browser user flows in `tests/e2e`.
