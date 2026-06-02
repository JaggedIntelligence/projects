from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

DEFAULT_UNIVERSE = "sp500_current"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass(frozen=True)
class SymbolMetadata:
    symbol: str
    provider_symbol: str
    name: str
    exchange: str = ""
    currency: str = "USD"
    sector: str | None = None
    industry: str | None = None


def load_symbol_universe(universe: str = DEFAULT_UNIVERSE) -> list[SymbolMetadata]:
    csv_path = DATA_DIR / f"{universe}.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Symbol universe not found: {csv_path}")

    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return [_entry_from_row(row) for row in reader if _has_symbol(row)]


def load_symbol_map(universe: str = DEFAULT_UNIVERSE) -> dict[str, SymbolMetadata]:
    return {entry.symbol: entry for entry in load_symbol_universe(universe)}


def to_provider_symbol(symbol: str, provider: str = "yfinance") -> str:
    normalized_symbol = normalize_symbol(symbol)
    if provider.lower() == "yfinance":
        return normalized_symbol.replace(".", "-")
    return normalized_symbol


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _entry_from_row(row: dict[str, str]) -> SymbolMetadata:
    symbol = normalize_symbol(_value(row, "symbol", "Symbol"))
    provider_symbol = _value(row, "provider_symbol", "Provider Symbol") or to_provider_symbol(symbol)

    return SymbolMetadata(
        symbol=symbol,
        provider_symbol=normalize_symbol(provider_symbol),
        name=_value(row, "name", "Security") or symbol,
        exchange=_value(row, "exchange", "Exchange"),
        currency=(_value(row, "currency", "Currency") or "USD").upper(),
        sector=_optional_value(row, "sector", "GICS Sector"),
        industry=_optional_value(row, "industry", "GICS Sub-Industry"),
    )


def _has_symbol(row: dict[str, str]) -> bool:
    return bool(_value(row, "symbol", "Symbol"))


def _optional_value(row: dict[str, str], *keys: str) -> str | None:
    value = _value(row, *keys)
    return value or None


def _value(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and value.strip():
            return value.strip()
    return ""
