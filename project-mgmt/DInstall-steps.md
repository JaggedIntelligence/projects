# Installation steps

### How to run 
 - on Mac terminal  
 - pnpm install
 - pnpm run dev
 - pnpm run db:studio   // to see Drizzle DBAdmin Stuio which connect to Postgres DB 
 -
 - if any issues , remove old stuff and start new
 - rm -rf node_modules .next 
 - .

### 1/ installation Trouble shooting
- with Orb Stack ubuntu, this web app gave many errors  with 'pnpm run dev' to bring up the application
- so the recommendation is use STANDARD MAC Terminal, so I did
- I installed  npm & pnpm on MAC terminal Shell  ( detailed steps below)

### 1.2 first Strt Postgres DB with Docker
- details are in the foler /server/docker/READme.md 

### 2/ How to make Drizzle DB Studio make it work
- Drizzle DB strudio is DB admin app for CRUD operaions to view Table structire .. and may more .. this is like PhyMyAdmin
- we got make it worknig, see details in commit# 22e8bba
- a) dotenv package added to package.json b) few changes in  drizzle.config.ts

 

## 5/ --------- How to install npm & pnpm  on MAC ------------------------------

### the below is Gemini anaser and it worked ...

### 1. Install Homebrew
Copy and paste this command into your terminal. It will ask for your Mac password (you won't see the characters as you type, which is normal) and will take a minute or two:

Bash  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"


### 2. CRITICAL: Add Homebrew to your PATH

Once the installation finishes, look at the terminal output. It will show a section called "Next steps". You must copy and paste the two or three lines of code it provides to add Homebrew to your system path.

It usually looks something like this (but copy the exact lines from your terminal):

Bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/sreddy/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

### 3. Now, install fnm and Node
Now that the brew command actually exists, you can proceed with the original plan:

Install fnm:

Bash
brew install fnm
Configure fnm for Zsh:

Bash
echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc
source ~/.zshrc
Install Node & pnpm:

Bash
    fnm install --lts
    corepack enable
    

### How to check if it worked:
Run `brew -v`. If it returns a version number instead of "command not found," you've successfully cleared the hurdle!

Are you planning to use this setup for a specific framework like React or Next.js, 