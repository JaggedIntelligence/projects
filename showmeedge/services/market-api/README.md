# Market API

FastAPI service for market-data workflows that should not live inside the Next.js app.

Current scope:

- QuestDB-backed OHLCV table creation.
- Mock/static OHLCV ingestion into QuestDB.
- OHLCV reads from QuestDB.
- Simple moving-average crossover backtest.

Local development:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

With Docker Compose from the repo root:

```bash
docker compose -f scripts/docker-compose.yml up -d questdb market-api
```

API docs are available at:

```text
http://localhost:8000/docs
```

