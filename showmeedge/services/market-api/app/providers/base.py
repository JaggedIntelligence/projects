from __future__ import annotations

from datetime import date
from typing import Protocol

from app.models import DailyOhlcvBar


class DailyBarProvider(Protocol):
    provider_name: str

    def fetch_daily_bars(
        self,
        symbols: list[str],
        start: date,
        end: date | None = None,
    ) -> list[DailyOhlcvBar]:
        """Fetch normalized daily bars for canonical app symbols."""
