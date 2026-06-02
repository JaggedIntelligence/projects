#  ShowmeEdge Project Status

### Big picture
 - here we list what is working and what is not 
 - over all project status

 ### What is working 
  - all 3 services are coming up with commands shown below.
  -.
  - but SR needs to test what is Inside QuestDB , how to add DB rows in Quest DB and get the DATA OUT
  - read /1PROJECT-DOCS/feature-add-FASTAPI*.md file
  

 ### QuestDB, FastAPI server, PostGresDB 
  - 1. all 3 are installed using docker specified in /scripts/docker-compose.yml file
  -
  - 2. QuestDB and PostgreDB are started and Stopped as below 
     pnpm db:start 
     pnpm db:stop 

     where above are defined in package.json as
        "db:start": "bash scripts/db-init.sh start"

 - 3. FastAPI Server is started with
    pnpm market-api:start 

    where above are defined in package.json as
        "market-api:start": "bash scripts/db-init.sh market",