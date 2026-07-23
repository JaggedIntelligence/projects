Use QuestDB `SYMBOL` columns in the main ratings table. Do not create four lookup tables.

QuestDB `SYMBOL` is effectively a dictionary-encoded string: each row stores a 32-bit integer while QuestDB keeps the distinct text values separately. You retain readable SQL such as `rating_action = 'downgrades'` without repeatedly storing the full string. This is precisely what `SYMBOL` is designed for. [QuestDB data types](https://questdb.com/docs/query/datatypes/overview/)

At 1,500 rows × 3,000 tickers, the table will contain approximately 4.5 million rows—quite modest for QuestDB.

## Recommended types

| Column | Recommended type | Initial capacity |
|---|---|---:|
| `price_target_action` | `SYMBOL` | 32 |
| `rating_action` | `SYMBOL` | 32 |
| `rating` | `SYMBOL` | 128 |
| `previous_rating` | `SYMBOL` | 128 |

For example:

```sql
price_target_action SYMBOL CAPACITY 32 CACHE,
rating_action       SYMBOL CAPACITY 32 CACHE,
rating              SYMBOL CAPACITY 128 CACHE,
previous_rating     SYMBOL CAPACITY 128 CACHE
```

Capacity is an initial sizing estimate, not a hard limit; QuestDB can expand it. `CACHE` is appropriate because these columns have low cardinality and is already the default. [QuestDB `SYMBOL` configuration](https://questdb.com/docs/query/sql/create-table/)

I suggest more capacity for `rating` because analyst firms may use many semantically similar labels:

```text
buy
strong buy
outperform
overweight
market outperform
sector outperform
hold
neutral
equal weight
market perform
sell
underperform
underweight
```

Even if the current sample has only 10–15 values, the raw vendor vocabulary may grow.

## Why not lookup tables?

Separate lookup tables would add complexity without producing meaningful storage savings:

- QuestDB `SYMBOL` already performs dictionary encoding internally.
- Every read would require joins to recover readable values.
- QuestDB does not support foreign keys or `CHECK` constraints, so lookup tables would not enforce valid values anyway. Validation must happen in the ingestion process. [QuestDB schema constraints](https://questdb.com/docs/schema-design-essentials/)
- Joining four small tables into ordinary analyst-rating queries makes the data model harder to use.

Approximately, four `SYMBOL` columns across 4.5 million rows require about:

```text
4 columns × 4 bytes × 4.5 million = 72 MB
```

That excludes small dictionaries and optional indexes. Equivalent `VARCHAR` columns require substantially more row storage.

## Raw rating versus normalized rating

There is one situation where additional mapping is useful: converting firm-specific rating language into a common scale.

I recommend storing both:

```sql
rating                 SYMBOL CAPACITY 128 CACHE,
rating_normalized      SYMBOL CAPACITY 16 CACHE,
previous_rating        SYMBOL CAPACITY 128 CACHE,
previous_rating_normalized SYMBOL CAPACITY 16 CACHE
```

For example:

| Raw rating | Normalized |
|---|---|
| `strong buy` | `buy` |
| `outperform` | `buy` |
| `overweight` | `buy` |
| `equal weight` | `hold` |
| `market perform` | `hold` |
| `underperform` | `sell` |

This preserves the original Massive/Benzinga value while giving the UI and analytics a stable `buy/hold/sell` classification.

The normalization rules can initially live in ingestion code. If we later need descriptions, display ordering, sentiment scores, or editable mappings, create one optional taxonomy table—not four tables:

```sql
CREATE TABLE analyst_rating_taxonomy (
    field_name SYMBOL CAPACITY 8,
    raw_value SYMBOL CAPACITY 256,
    normalized_value SYMBOL CAPACITY 32,
    display_name VARCHAR,
    sentiment_score DOUBLE,
    display_order INT,
    is_active BOOLEAN
);
```

That table would be metadata; the normalized value should still be written into the fact table so normal queries do not require joins.

## Preliminary main-table structure

```sql
CREATE TABLE IF NOT EXISTS benzinga_analyst_ratings (
    event_ts TIMESTAMP,

    benzinga_id VARCHAR,
    ticker SYMBOL CAPACITY 8192 CACHE INDEX,

    price_target_action SYMBOL CAPACITY 32 CACHE,
    rating SYMBOL CAPACITY 128 CACHE,
    rating_normalized SYMBOL CAPACITY 16 CACHE,
    rating_action SYMBOL CAPACITY 32 CACHE,
    previous_rating SYMBOL CAPACITY 128 CACHE,
    previous_rating_normalized SYMBOL CAPACITY 16 CACHE,

    price_target DOUBLE,
    previous_price_target DOUBLE,
    adjusted_price_target DOUBLE,
    previous_adjusted_price_target DOUBLE,
    price_percent_change DOUBLE,

    last_updated TIMESTAMP,
    ingested_at TIMESTAMP,
    run_id SYMBOL CAPACITY 1024
) TIMESTAMP(event_ts)
PARTITION BY YEAR WAL
DEDUP UPSERT KEYS(event_ts, benzinga_id);
```

Important choices:

- `benzinga_id` is `VARCHAR`, not `SYMBOL`, because nearly every row will have a unique ID.
- `ticker` is indexed because selecting one ticker out of 3,000 is highly selective.
- I would not initially index the four rating/action columns. Time and ticker filtering should reduce the working set sufficiently; extra indexes add write and disk overhead.
- `PARTITION BY YEAR` is appropriate for roughly 4.5 million historical rows. QuestDB recommends yearly partitions for fewer than one million rows per day. [QuestDB partitioning guidance](https://questdb.com/docs/concepts/partitions/)
- Deduplication makes retries and overlapping refresh windows idempotent. QuestDB requires the designated timestamp to be part of the upsert key. [QuestDB deduplication](https://questdb.com/docs/concepts/deduplication/)

The repository currently runs QuestDB 9.3.5 in [docker-compose.yml](/Users/sreddy/projects/showmeedge/scripts/docker-compose.yml:22). Before finalizing the SQL, the next design step should be profiling the actual JSONL results to list distinct values and null rates for these four columns. That will confirm whether `rating` really has 10–15 values or a larger firm-specific vocabulary. No files were changed during this design discussion.
