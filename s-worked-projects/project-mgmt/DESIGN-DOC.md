# Second Brain Task Manager Design Doc

## Project Overview

Second Brain Task Manager is a full-stack task management app built with Next.js 14 App Router. It provides authenticated users with a focused task workflow: create, edit, delete, search, filter, prioritize, assign due dates, and track status.

The app is designed as a modern TypeScript stack:

- Next.js 14 App Router for routing, layouts, server routes, and deployment.
- Tailwind CSS with shadcn/ui-style components for consistent responsive UI.
- Zustand for shared client-side task UI state across pages.
- Clerk for authentication with Google and GitHub OAuth configured in Clerk.
- tRPC for type-safe API calls between React components and backend procedures.
- Zod for all task input validation.
- Drizzle ORM with Postgres for persistent task storage.
- Vite/Vitest configuration for frontend-oriented test tooling.

## Product Goals

- Keep the first screen functional, not a marketing page.
- Provide a responsive task workspace that works well on mobile and desktop.
- Keep task actions fast and obvious: create, edit, delete, filter, and update status.
- Require authentication before accessing task data.
- Keep every user scoped to their own tasks through Clerk `userId`.
- Keep validation shared and explicit with Zod schemas.

## Core Features

- Create tasks with title, optional description, status, priority, and due date.
- Edit existing tasks through the same dialog-based editor.
- Delete tasks from the task list.
- Update task status inline.
- Filter tasks by status and priority.
- Search tasks by title.
- View task summary stats.
- Toggle light/dark/system-compatible themes.
- Protect task pages and tRPC task routes with Clerk middleware.

## Architecture Decisions

### Next.js App Router

The app uses Next.js 14 App Router because it provides file-based layouts, colocated route handlers, and a clean protected app shell. Public auth routes live outside the protected route group, while dashboard and task routes live inside `app/(app)`.

### Clerk Auth

Clerk is used for authentication because it gives hosted auth UI, OAuth provider support, session handling, and middleware protection. Google and GitHub login are enabled from the Clerk dashboard rather than hardcoded in the app.

Protected routes are enforced in `middleware.ts` for:

- `/dashboard`
- `/tasks`
- `/api/trpc`

Task ownership is enforced again in the backend by filtering all task queries and mutations by Clerk `userId`.

### tRPC API Layer

tRPC is used to keep frontend API calls type-safe without manually maintaining REST request and response types. The task router exposes:

- `tasks.list`
- `tasks.create`
- `tasks.update`
- `tasks.delete`

All procedures that touch task data are protected procedures.

### Zod Validation

Zod schemas live in `lib/validators.ts` and are shared by the form layer and backend router. This keeps validation consistent across the app.

The main schemas are:

- `taskCreateSchema`
- `taskUpdateSchema`
- `taskDeleteSchema`
- `taskListSchema`
- `taskPrioritySchema`
- `taskStatusSchema`

### Drizzle ORM and Postgres

Drizzle is used for typed database access with Postgres. The task schema is defined in `server/db/schema.ts`.

The `tasks` table stores:

- `id`
- `userId`
- `title`
- `description`
- `priority`
- `status`
- `dueDate`
- `createdAt`
- `updatedAt`

Indexes are added for common user-scoped filters:

- user id
- user id plus status
- user id plus priority

An initial SQL bootstrap file is included at `db/init.sql` for quick local database setup.

### Zustand State Management

Zustand is used for client-side task UI state because filters, search, and the task editor need to be shared across dashboard, tasks page, shell actions, and modal state.

The store in `store/task-store.ts` manages:

- search text
- status filter
- priority filter
- selected editing task
- editor open/closed state
- create/edit modal actions
- filter reset action

This lets both `/dashboard` and `/tasks` reuse the same task page experience and state model.

### UI and Design System

The UI uses Tailwind CSS and local shadcn/ui-style components instead of depending on generated component code at runtime. Components are intentionally simple, accessible, and easy to modify.

Design choices:

- Compact operational interface instead of a marketing landing page.
- Cards only for task rows, stats, and empty/error states.
- Responsive layout with single-column mobile flow and denser desktop grids.
- Icons from `lucide-react` for common actions.
- Dark mode through `next-themes`.
- Neutral base palette with teal primary accents, avoiding a single-hue interface.

### Vite Configuration

This is a Next.js app, so production and development bundling are handled by Next. `vite.config.ts` exists for Vitest and React test tooling, satisfying the deploy/tooling requirement without replacing Next's runtime build pipeline.

### Deployment

The app includes `vercel.json` with standard Next.js build, install, and dev commands. Environment variables are documented in `.env.example`.

## Folder Structure

```text
.
├── app
│   ├── (app)
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── tasks
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api
│   │   └── trpc
│   │       └── [trpc]
│   │           └── route.ts
│   ├── sign-in
│   │   └── [[...sign-in]]
│   │       └── page.tsx
│   ├── sign-up
│   │   └── [[...sign-up]]
│   │       └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── providers
│   │   ├── app-providers.tsx
│   │   ├── theme-provider.tsx
│   │   └── trpc-provider.tsx
│   ├── tasks
│   │   ├── task-editor.tsx
│   │   ├── task-filters.tsx
│   │   ├── task-list.tsx
│   │   ├── task-page.tsx
│   │   └── task-stats.tsx
│   ├── ui
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── popover.tsx
│   │   ├── select.tsx
│   │   └── textarea.tsx
│   └── app-shell.tsx
├── db
│   └── init.sql
├── lib
│   ├── utils.ts
│   └── validators.ts
├── server
│   ├── api
│   │   ├── routers
│   │   │   └── tasks.ts
│   │   ├── root.ts
│   │   └── trpc.ts
│   └── db
│       ├── index.ts
│       └── schema.ts
├── store
│   └── task-store.ts
├── .env.example
├── .eslintrc.json
├── .gitignore
├── components.json
├── drizzle.config.ts
├── middleware.ts
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

## Key Files

### App and Routing

- `app/layout.tsx`: Root layout, global providers, metadata, and global styles.
- `app/page.tsx`: Redirects authenticated users to `/dashboard` and guests to `/sign-in`.
- `app/(app)/layout.tsx`: Protected app shell wrapping dashboard and task pages.
- `app/(app)/dashboard/page.tsx`: Dashboard route using shared task page.
- `app/(app)/tasks/page.tsx`: Full tasks route using shared task page.
- `app/api/trpc/[trpc]/route.ts`: tRPC fetch route handler.
- `middleware.ts`: Clerk protected route middleware.

### Task UI

- `components/tasks/task-page.tsx`: Shared task page composition.
- `components/tasks/task-filters.tsx`: Zustand-backed search/status/priority filters.
- `components/tasks/task-list.tsx`: Task rows, inline status update, edit, and delete.
- `components/tasks/task-editor.tsx`: Create/edit form with Zod validation and calendar picker.
- `components/tasks/task-stats.tsx`: Summary cards for task counts.

### State

- `store/task-store.ts`: Zustand store for task filters and editor state.

### API and Database

- `server/api/trpc.ts`: tRPC context, router helpers, and protected procedure.
- `server/api/root.ts`: Root API router.
- `server/api/routers/tasks.ts`: Task CRUD procedures.
- `server/db/schema.ts`: Drizzle schema for tasks.
- `server/db/index.ts`: Drizzle Postgres client.
- `db/init.sql`: Initial SQL schema for local bootstrap.

### Validation and Utilities

- `lib/validators.ts`: Zod schemas and inferred task types.
- `lib/utils.ts`: Tailwind class merge helper.

### Configuration

- `package.json`: Dependencies and scripts.
- `.env.example`: Required environment variables.
- `drizzle.config.ts`: Drizzle Kit configuration.
- `tailwind.config.ts`: Tailwind theme, dark mode, and shadcn tokens.
- `postcss.config.mjs`: Tailwind and Autoprefixer PostCSS config.
- `vite.config.ts`: Vitest/Vite test tooling config.
- `vercel.json`: Vercel deployment commands.
- `components.json`: shadcn/ui metadata and aliases.

## Environment Variables

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/second_brain"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

## Data Model

```text
tasks
├── id: uuid primary key
├── user_id: text
├── title: text
├── description: text nullable
├── priority: enum low | medium | high
├── status: enum todo | in_progress | done
├── due_date: timestamp with time zone nullable
├── created_at: timestamp with time zone
└── updated_at: timestamp with time zone
```

## Setup Notes

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env.local
```

Generate and run Drizzle migrations:

```bash
npm run db:generate
npm run db:migrate
```

Run development server:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

## Current Limitations

- Clerk OAuth providers must be enabled in the Clerk dashboard.
- The local environment needs a package manager such as `npm` or `pnpm`.
- The current implementation does not include automated tests yet, but Vite/Vitest configuration is present.
- Task data is user-scoped by Clerk user id, but there is no team or shared workspace model.

## Future Improvements

- Add optimistic updates for task mutations.
- Add recurring tasks.
- Add task labels or projects.
- Add drag-and-drop status lanes.
- Add automated unit and integration tests.
- Add empty-state quick actions for common task templates.
