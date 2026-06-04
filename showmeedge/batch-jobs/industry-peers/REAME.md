
# Industry Peer group ticker

### Big picture

The peer group will help to see how related Peers are doing on a given day , week , month

other web sites such as  CNBC.com are giving good Peers, they are giving lots of random Peers 
here is CNBC peers for  ZS Zscalar which is utter wron, there are :  Google, Meta, Microsoft ORACLE 
https://www.cnbc.com/quotes/ZS?tab=peers

Where as yahoo shows ZS proper peers as:
 - PANW, CRWD Crowd strike .  ofcourse , there a #1 and #2  peers/competators

getting peers into Database is big part 

- this program will help to extract and get into DB

- for Marvel this program show good Peers
https://finance.yahoo.com/quote/MRVL/


### Here is command line run and the Output 

- Here Rank is good thing, keep that field Rank  in the DB for the Symbol ..
```
% node batch-jobs/industry-peers/generate-peers-manifest.mjs --ticker ZS  --timeout-ms 20000

```
{"sourceTicker":"ZS","rank":2,"peerTicker":"PANW","companyName":"Palo Alto Networks, Inc.","price":"280.43","changePercent":"-5.64%","marketCap":"228.55B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/PANW/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":3,"peerTicker":"CRWD","companyName":"CrowdStrike Holdings, Inc.","price":"747.61","changePercent":"-2.78%","marketCap":"190.294B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/CRWD/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":4,"peerTicker":"NET","companyName":"Cloudflare, Inc.","price":"265.33","changePercent":"-2.69%","marketCap":"93.785B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/NET/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":5,"peerTicker":"OKTA","companyName":"Okta, Inc.","price":"124.65","changePercent":"-7.89%","marketCap":"21.857B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/OKTA/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":6,"peerTicker":"MDB","companyName":"MongoDB, Inc.","price":"368.32","changePercent":"-7.56%","marketCap":"29.625B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/MDB/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":7,"peerTicker":"FTNT","companyName":"Fortinet, Inc.","price":"146.48","changePercent":"-1.60%","marketCap":"107.318B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/FTNT/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":8,"peerTicker":"RBRK","companyName":"Rubrik, Inc.","price":"79.46","changePercent":"-3.49%","marketCap":"16.354B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/RBRK/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":9,"peerTicker":"S","companyName":"SentinelOne, Inc.","price":"16.30","changePercent":"-6.05%","marketCap":"5.566B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/S/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":10,"peerTicker":"SNPS","companyName":"Synopsys, Inc.","price":"498.02","changePercent":"-2.03%","marketCap":"95.361B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/SNPS/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}

{"sourceTicker":"ZS","rank":11,"peerTicker":"TWLO","companyName":"Twilio Inc.","price":"227.26","changePercent":"-0.89%","marketCap":"34.492B","industry":"Software—Infrastructure","quoteUrl":"https://finance.yahoo.com/quote/TWLO/","sourceUrl":"https://finance.yahoo.com/quote/ZS/"}
sreddy@Subbas-Ma

```

### QuestDB insert

The QuestDB table is defined in:

```text
batch-jobs/industry-peers/sql/industry_peers_table.sql
```

The scraper still writes the full Yahoo peer JSONL for inspection, but QuestDB inserts only the essential columns from that table:

```bash
node batch-jobs/industry-peers/generate-peers-manifest.mjs \
  --ticker ZS \
  --timeout-ms 20000 \
  --output batch-jobs/industry-peers/runs/zs-peers.jsonl \
  --insert-questdb
```

Useful dry-run form:

```bash
node batch-jobs/industry-peers/generate-peers-manifest.mjs \
  --ticker ZS \
  --timeout-ms 20000 \
  --insert-questdb \
  --dry-run
```

Default QuestDB connection:

```text
QUESTDB_URL=postgres://admin:quest@127.0.0.1:8812/qdb
```
