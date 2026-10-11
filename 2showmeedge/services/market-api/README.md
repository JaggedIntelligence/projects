# Market API

FastAPI service for market-data workflows that should not live inside the Next.js app.

Current scope:

- QuestDB-backed OHLCV table creation.
- Mock/static OHLCV ingestion into QuestDB.
- OHLCV reads from QuestDB.
- VectorBT-backed moving-average crossover backtest with a manual fallback when VectorBT is not installed.

Local development:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

VectorBT requires Python 3.10 or newer. The Docker image uses Python 3.12.

With Docker Compose from the repo root:

```bash
docker compose -f scripts/docker-compose.yml up -d questdb market-api
```

API docs are available at:

```text
http://localhost:8000/docs
```
