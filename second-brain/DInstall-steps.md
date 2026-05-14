# Installation steps



## --------- How to install npm & pnpm  on MAC ------------------------------

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