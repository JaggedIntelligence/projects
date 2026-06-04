
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

### S&P 500 batch backfill

Use this wrapper for the normal S&P 500 industry peers load:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh
```

Defaults:

```text
UNIVERSE=sp500_current
PROGRAM_ID=yahoo-finance-compare-to
RECORD_INSERT_FLAG=skip
```

`skip` means a source ticker is skipped when rows already exist for `source_ticker + program_id`.

Smoke-test form:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --max-symbols 20 \
  --allow-small-universe \
  --dry-run
```

Force a fresh snapshot:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --record_insert_flag newrecord
```

### Targeted wrapper run

Use the same wrapper path for one source ticker or a small subset:

```bash
bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
  --ticker AAPL \
  --allow-small-universe \
  --dry-run
```

### QuestDB insert

The QuestDB table is defined in:

```text
batch-jobs/industry-peers/sql/industry_peers_table.sql
```

The batch flow writes relationship JSONL artifacts under `runs/<run-id>/` and inserts only the essential columns from that table.

Default QuestDB connection:

```text
QUESTDB_URL=postgres://admin:quest@127.0.0.1:8812/qdb
```
