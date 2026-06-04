
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
{"sourceTicker":"ZS","rank":2,"peerTicker":"PANW","companyName":"Palo Alto Networks, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":3,"peerTicker":"CRWD","companyName":"CrowdStrike Holdings, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":4,"peerTicker":"NET","companyName":"Cloudflare, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":5,"peerTicker":"OKTA","companyName":"Okta, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":6,"peerTicker":"MDB","companyName":"MongoDB, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":7,"peerTicker":"FTNT","companyName":"Fortinet, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":8,"peerTicker":"RBRK","companyName":"Rubrik, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":9,"peerTicker":"S","companyName":"SentinelOne, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":10,"peerTicker":"SNPS","companyName":"Synopsys, Inc.","industry":"Software—Infrastructure"}

{"sourceTicker":"ZS","rank":11,"peerTicker":"TWLO","companyName":"Twilio Inc.","industry":"Software—Infrastructure"}
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
