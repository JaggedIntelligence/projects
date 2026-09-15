# JOB SCHEDULER to run "Batch Jobs" periodcally 

### Tool Selection
 - we looked at couple of  "JOB SCHEDULER" and Started in our Github Repo
 - some of them are simple CRON Job setup, we need ONE tool covering ALL ( Alerts, CPU MEMEORU usage Monior etc.)
 - Chronicle is the mother first version
 - same author wrote XyOps as Modern verions
 - .
 - SR final selection sofar seems XyOps  (OSS, 6.2k starts, active devlopment 4 days ago )
 - https://github.com/pixlcore/xyops

### XyOps : Your job scheduler should know what your servers are doing.

XyOps : https://xyops.io/
 
 Schedule every job. 
 Orchestrate every workflow. 
 Watch every server. 
 Respond with full context.

 SR note: with the following setup, it XyOps running bloomberg-video-batch job of run.sh worked and created FILes
  - only issue Files are owned by ROOT user.
  - see SR solution in point 5. below

**1/ Install Steps**

0. here is **Gemini answers saveed link**: https://share.gemini.google/UNy43IZJHWNg
1. there are two optinos Docker and Node.js based
2. we went with Simple Node based 

git clone https://github.com/pixlcore/xyops.git
cd xyops

Install Dependencies & Build:Bashnpm install
node bin/build.js dev

Create Configuration Override:Create a local configuration file with a secret key:Bash
echo '{ "secret_key": "test" }' > conf/overrides.json

Start xyOps in Debug Mode:Bash
bin/debug.sh

Access the Dashboard:Open http://localhost:5522 in your browser and log in with the default credentials (admin / admin).  

**2/ Installed Satellite**
curl -s "http://subbas-macbook-air.local:5522/api/app/satellite/install?t=41cd1d47815876c7f61db88ed2f2ba300786d2b8017d85f46a20e7964a737e46" | sudo sh

3. Create Server 
- go to http://localhost:5522/#Servers
- Add server with server name :  subbas-macbook-air.local ( got with $hostname )

4. create Event 
 - see the Saved one here in this folder, get the details 
 - xyops-events.json 
 - schdule Time and repeats ( ask Cron Experssion to Gemini if needed, we have one in FILE)

**5. Running JOBS : the Issues**
 - the script/command in the EVENT is:
 /Users/sreddy/projects/showmeedge/batch-jobs/market-news-analysis-on-youtube/bloomberg-youtube/run.sh

 - it is creating files as ROOT user, so chaned it to
 !/bin/bash 
 sudo -u sreddy /Users/sreddy/....*/run.sh

 now it complains, USER can not access Parent Folders ..

 6. Soluiton :
  - option 1:  pay to that $10 VPS server and use Ubuntu and setit up there with sreddy and root user proper setup
  - my guess is Mac Linux is cribbing these permission
  -.
  - option 2: install Omarchy on this MAC and use it ... but again it is not Ubuntu .. our Proudction will be Ubuntu 


