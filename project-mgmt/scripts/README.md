# Docker operations

### big picture
- this file is created by SReddy
- to do bring up PostgresDB with docker-compose.yml file
- to Stop and Start DB 

### Commands to Start and Stop DB

1. be on Mac terminal, not OrbStack terminal. OrbStack Ubuntu can have issues with Docker.
2. be in the project root folder.
3. issue these commands through `package.json`.

```
Goal                  Command 
-----                 --------------
Initialize DB         pnpm db:init

Start DB              pnpm db:start

Stop DB               pnpm db:stop

Reset DB              pnpm db:reset

Watch Messages        docker compose -f scripts/docker-compose.yml logs -f

Check Status          docker compose -f scripts/docker-compose.yml ps
```
