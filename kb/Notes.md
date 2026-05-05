# Notes about /kb Kowlege Base project

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


### Big Picture 
- see the working Open Soure app first to get idea of Web app we are trying to modify
- url is https://buildwithclaude.com/plugins
- .
-  The following web app repository is cloned from the repo https://github.com/davepoon/buildwithclaude/tree/main/web-ui ...
-  and only /web-ui folder is copied and created our own web app in this /kb/web-ui folder
- .

## test on April. 15 ---

### 1. How to run this web app
clone this public repo https://github.com/JaggedIntelligence/projects

cd kb

npm install

npm run dev 

open browser with localhost:3000

### 2. Web app status
The Web app runs with above steps
- All Menus works ...
- If you look at Console of ( web app run), it shows Errors
    - Erros are due to missing folder of DATA needed to feed the web application 

### 3. Help needed Areas
- 1. for Fixing the errors by giving some data probably looking at the ORIGNAL Project data in https://github.com/davepoon/buildwithclaude/tree/main/web-ui 
- 2. do some customizations to our  /kb Knowledge Base web app
