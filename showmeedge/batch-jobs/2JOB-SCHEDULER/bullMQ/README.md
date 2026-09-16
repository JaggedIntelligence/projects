# BullMQ Job/Message Queue and Scheduler

### BullMQ dual role
- it can work as both  "Job Scheduler" and Message Queue/DeQueue
- for /showmeEdge project "market data fetch" we are using it as "Batch Job Scheduler to excute CRON like JOB perioidically"
- .
- here RADIS Server is installed and Started as SERVICE 
- where as "bullmq" and "ioredis" are Node Package installed as part of npm install
- that is the KEY difference ONE need to NOTE here ...


## 1/ Prerequisites & Installation

this Gemini AI chat helped in making this test program share url is: 
https://share.gemini.google/wmMkmZPqRgeB

STEP 1: Install "Redis Server" (required by BullMQ for queue management)
-- On macOS via Homebrew  // SR followed this since we are on MAC which is Darwin OS not Linux ..
brew install redis
brew services start redis  // Radis service with Queue Starts in the Background process

-- On Ubuntu/Debian
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server

STEP  2: Node.js Project Setup
be in main folder like /billmq and install
npm init -y
npm install bullmq ioredis    // BullMQ and Radis package installs

### 2/ project files and main JS file holding BullMQ setup and Tasks/Jobs ...
mkdir job1 && cd job1
create script.py //  code file in which test FILES are crated
create runner.sh
create job1.js // main JS file 

## 3/ How to run
chmod +x *

node job1.js  // this will run program , you can check test FILES created in /job1/outout Folder 