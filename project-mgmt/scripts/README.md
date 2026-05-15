# Docker operations

### big picture
- this file is created by SReddy
- to do bring up PostgresDB with docker-compose.yml file
- to Stop and Start DB 

### 1/ Commands to Start and Stop Postgres DB which is defined in the file /scripts/docker-compose.yml

1. be on Mac terminal, not OrbStack terminal. OrbStack Ubuntu can have issues with Docker.
2. be in the project root folder.
3. issue these commands through `package.json`.

```
Goal                        Command 
-----                       --------------
Initialize DB                       pnpm db:init    <-- these 4 are pnpm commmands defined in package.json. --- >
(create tabel Schema in Postgres DB)

Start DB                    pnpm db:start

Stop DB                     pnpm db:stop

Reset DB                    pnpm db:reset

Check Status                docker  ps              <--    these 2  are regular Docker commands ---->

Watch Messages              docker logs -f second-brain-postgres
(last param container name)
```

###  2/ major rewrite of "Postgres DB Docker container" operations of START and STOP

Now these operation are controlled with pnpm commands ( which are in package.json) in a simpler way and it all Works:

pnpm db:start

pnpm db:stop

###  3/ Meet Drizzle Studio
🖥 Drizzle Studio is a new way for you to explore SQL database on Drizzle projects.

https://orm.drizzle.team/drizzle-studio/overview 

SR Notes:
 - we have dirzzle-kit in package.json, all you do is on a Mac terminal at the root  folder /project-mgmt
 - pnpm db:studio
 - this will start a new web app, here to the web page url to see FULL Database ...
 - https://local.drizzle.studio
