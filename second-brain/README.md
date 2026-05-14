# Second Brain Task Manager

A full-stack task management app built with Next.js 14 App Router, Tailwind CSS, shadcn/ui-style components, Zustand, Clerk, tRPC, Drizzle ORM, Zod, and Postgres.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Create a Clerk application with GitHub and Google OAuth enabled, then add the keys to `.env.local`.

4. Start Postgres and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

For a quick local database bootstrap, `db/init.sql` contains the equivalent initial schema.

5. Run the app:

```bash
npm run dev
```

## Vite

This is a Next.js app, so runtime bundling is handled by Next. `vite.config.ts` is included for Vitest/unit-test tooling.
