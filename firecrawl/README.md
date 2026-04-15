# WebScraping with FireCrawl

### Big Picture
0. Why we are doing with this **Paid FireCrawl instead of OSS Free**
    - for $20 it gives 100 pages/day of Scrap that is good enough for us ..
    - hope it will do not give bugs and hickupps
    - it will allow Login session required Websites such as finviz.com  tipsrank.com etc..
    - .

### 1/ firecrawl setup

https://docs.firecrawl.dev/introduction

1. when accout signed up on FireCrawl (srview9@gmail.com) , it gave this URL, I ran it on Linux terminal 
2. it crated a Package.json file ..

npx -y firecrawl-cli@latest init --all -k fc-a7bcd65510f842dda32d87adf0dd1713 


3. also ran this , this opened browser and signed up with above FireCrawl Google Auth
npx -y firecrawl-cli@latest init --all --browser

4. It gave a API token screen , copied that API token to .jS files 

### 2/ Use Cheerio to Parse HTML 
- this is much easier THAN using those LLM crap or FireCrawl crap
- just use FireCrawl to get the first HMTL page content, then do every thing with Cheerio...  much CLEANER ...\
- .

### 3/ HOW TO RUN to extract Web scrape DATA
How to run
    npm install     // installs packages specified in package.json 
    node finviz.js 
 


### 4/ Docs

**1/ FireCrawl** 
    Cheerio is BeautifulSoup (Python) equivalent in JS
    https://docs.firecrawl.dev/introduction
    
 

**2/ Cheerio** 
    Cheerio is BeautifulSoup (Python) equivalent in JS
    Cheerio : The fast, flexible, and elegant library for parsing and manipulating HTML and XML.
    https://cheerio.js.org/
    https://github.com/cheeriojs/cheerio


## FireCrawl Indepath


### Interactive Live View

https://docs.firecrawl.dev/features/interact

The response also includes an interactiveLiveViewUrl. Unlike the standard live view which is view-only, the interactive live view allows users to click, type, and interact with the browser session directly through the embedded stream. **This is useful for building user-facing browser UIs — such as login flows, or guided workflows where end users need to control the browser.**