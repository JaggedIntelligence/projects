/**************************************************************************************
 * 
 *  How to run
 *    npm install     // installs packages specified in package.json 
 *    node finviz.js 
 * 
 */

import FirecrawlClient  from '@mendable/firecrawl-js';

import * as cheerio from 'cheerio';

const client = new FirecrawlClient({ apiKey: 'fc-a7bcd65510f842dda32d87adf0dd1713' });

const doc = await client.scrapeUrl('https://finviz.com/quote.ashx?t=AVGO&p=d', {
  formats: ['markdown', 'html'],
  maxAge: 0,             // force fresh
  storeInCache: false,   // don't store
  waitFor: 5000,         // wait 2s
});

console.log(doc.metadata?.cacheState); // hit/miss
//console.log(doc.markdown)
// console.log(doc.html) // works 

// here $ can be any variable name ...
const $ = cheerio.load(doc.html); 

//const divtext = $('.fv-container').html();  // works

// find is performant when NESTED elements are involved ...
const c2 = $('.fv-container').find('.body-table-news-wrapper').html();

console.log(c2)
