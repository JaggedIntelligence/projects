# Astro + React Example

```sh
npm create astro@latest -- --template framework-react
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/framework-react)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/framework-react)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/framework-react/devcontainer.json)

This example showcases Astro working with [React](https://react.dev).

Write your React components as `.jsx` or `.tsx` files in your project.

## TODO app

The TODO page is at `/todo`. It uses React for the interface, Astro API routes for
CRUD operations, Drizzle for queries and migrations, and a disk-backed PGlite
database on the Node server. Tasks are currently one shared list for everyone
who can reach the app; protect the site or add user authentication before
exposing private tasks publicly.

Run from this project directory:

```sh
npm install
npm run dev
```

For a production build:

```sh
npm run build
TODO_DB_DIR=/absolute/path/on/persistent/storage npm start
```

`TODO_DB_DIR` must point to a writable, persistent **directory**. If it is not
set, PGlite uses `data/todo-pglite` relative to the process working directory;
`data/` is Git-ignored. Start the Node server from this project directory so it
can read the committed `drizzle/` migrations. The first API request opens the
database and applies any pending migrations. Back up the data directory, and
run only one Node server process against a given PGlite directory.

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the
new migration files.
