# Docker operations

### big picture
- this file is created by SReddy
- to do bring up PostgresDB with docker-compose.yml file
- to Stop and Start DB 

### Commands to Start and Stop DB

1. be on Mac terminal , not Orb STack terminal. Orb STack Ubuntu have some issues with Docker
2. be on mac termnal and this folder  /server/docker
3. issue these below commands ..

```
Goal                  Command 
-----                 --------------
Start & Background    docker-compose up -d
( -d for detached )

Watch Messages        docker-compose logs -f

Check Status          docker-compose ps

Shutdown Everything   docker-compose down

remove name.          docker rm -f second-brain-postgres
(may not need)
```