import FirecrawlClient  from '@mendable/firecrawl-js';

const client = new FirecrawlClient({ apiKey: 'fc-a7bcd65510f842dda32d87adf0dd1713' });

const doc = await client.scrapeUrl('https://finviz.com/quote.ashx?t=AVGO&p=d', {
  formats: ['markdown', 'html'],
  maxAge: 0,             // force fresh
  storeInCache: false,   // don't store
  waitFor: 5000,         // wait 2s
});

console.log(doc.metadata?.cacheState); // hit/miss
console.log(doc.markdown)