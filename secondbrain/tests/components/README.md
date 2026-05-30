# Component Tests

This folder contains the frontend component-test layer from `TEST-SPEC.md`.

These tests use Vitest with React Testing Library. They focus on component rendering, UI state, and user interactions that do not need a real browser session.

Current coverage:

- `task-filters.test.tsx`: search input, reset behavior, and store integration
- `task-stats.test.tsx`: task summary counts from mocked tRPC query data
- `task-list.test.tsx`: loading/error/empty/list states plus edit/delete interactions
- `task-editor.test.tsx`: create/edit dialog rendering, validation, and submit payloads

## Install Dependencies

The component test layer needs Testing Library packages:

```sh
pnpm install
```

## Run Component Tests

Run the component suite once:

```sh
pnpm test:components
```

Run the component suite in watch mode:

```sh
pnpm test:components:watch
```

Run all Vitest tests:

```sh
pnpm test
```

## Notes

- Keep component tests focused on UI behavior.
- Mock tRPC hooks when a component is coupled to `api.tasks.*`.
- Put real database and router behavior in `tests/api`.
- Put full user workflows in `tests/e2e`.
