# Notes about /kb Kowlege Base project

### Big picture steps
1. DB setup
    Codex helped with Drizzle ORM issues and it asked to connect 'Neon Cloud Postgress' 
    SR created Neon account and copied  to  ~/.env file 
    then app starts working ... http://localhost:3000/subagents

2. copied .md files and url shows .md files
    see details below ...


### Code base understanding

**1. working url and it's CODE File**
  http://localhost:3000/subagents
  kb/web-ui/lib/subagents-server.ts

  the .ts file is referring .md files in folder /kb/plugins/all-agents/agents
  SR copied those .md files from github main repo ..
  ```
  export function getAllSubagents(): Subagent[] {
    const subagentsDirectory = path.join(process.cwd(), '../plugins/all-agents/agents')
    const fileNames = fs.readdirSync(subagentsDirectory)
  ```




### Neon Postgres Connection String & API key
got from this url 
https://console.neon.tech/app/settings
SR note: logged in using  github Credentails ...

Connection string
postgresql://neondb_owner:npg_QPJjpisy4Vz8@ep-cool-firefly-amti3iop-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require


password for the owner 
npg_QPJjpisy4Vz8

API key
napi_zsw2p46a257i9jypoj6npqvmfy3hidb7z42csajqd1f4f55p7wqquo2rzzd5i0oc


