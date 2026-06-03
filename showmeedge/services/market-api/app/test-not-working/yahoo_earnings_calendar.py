from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import zlib
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

YAHOO_EARNINGS_PAGE_URL = "https://finance.yahoo.com/calendar/earnings"
YAHOO_EARNINGS_API_URL = "https://query1.finance.yahoo.com/v1/finance/calendar/earnings"
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


@dataclass(frozen=True)
class EarningsCalendarEvent:
    symbol: str
    earnings_date: date
    earnings_date_source: str = "row"
    company_name: str | None = None
    earnings_datetime: str | None = None
    earnings_time: str | None = None
    eps_estimate: float | None = None
    reported_eps: float | None = None
    surprise_pct: float | None = None
    provider: str = "yahoo"


class YahooEarningsCalendarError(RuntimeError):
    pass


class YahooEarningsCalendarFetchError(YahooEarningsCalendarError):
    pass


class YahooEarningsCalendarProvider:
    def __init__(
        self,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.user_agent = user_agent

    def fetch_range(
        self,
        start: date,
        end: date,
        day: date | None = None,
        source: str = "auto",
    ) -> list[EarningsCalendarEvent]:
        if source not in {"auto", "api", "html"}:
            raise ValueError("source must be one of: auto, api, html")

        if source in {"auto", "api"}:
            try:
                events = self.fetch_api_range(start=start, end=end, day=day)
                if events or source == "api":
                    return events
            except YahooEarningsCalendarFetchError:
                if source == "api":
                    raise

        html = self.fetch_html_range(start=start, end=end, day=day)
        return parse_earnings_calendar_html(html, fallback_day=day or start)

    def fetch_day(self, day: date, source: str = "auto") -> list[EarningsCalendarEvent]:
        return self.fetch_range(start=day, end=day, day=day, source=source)

    def fetch_api_range(
        self,
        start: date,
        end: date,
        day: date | None = None,
    ) -> list[EarningsCalendarEvent]:
        params = {
            "from": start.isoformat(),
            "to": end.isoformat(),
        }
        if day is not None:
            params["day"] = day.isoformat()

        payload = self._fetch_json(YAHOO_EARNINGS_API_URL, params)
        return parse_earnings_calendar_api_payload(payload, fallback_day=day or start)

    def fetch_html_range(
        self,
        start: date,
        end: date,
        day: date | None = None,
    ) -> str:
        params = {
            "from": start.isoformat(),
            "to": end.isoformat(),
        }
        if day is not None:
            params["day"] = day.isoformat()
        return self._fetch_text(YAHOO_EARNINGS_PAGE_URL, params, accept="text/html")

    def _fetch_json(self, url: str, params: dict[str, str]) -> Any:
        text = self._fetch_text(url, params, accept="application/json,text/plain,*/*")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            snippet = text.strip()[:200]
            raise YahooEarningsCalendarFetchError(f"Yahoo returned non-JSON response: {snippet}") from exc

    def _fetch_text(self, url: str, params: dict[str, str], accept: str) -> str:
        request_url = f"{url}?{urlencode(params)}"
        request = Request(
            request_url,
            headers={
                "User-Agent": self.user_agent,
                "Accept": accept,
                "Accept-Encoding": "gzip, deflate",
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "close",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read()
                encoding = response.headers.get("Content-Encoding", "")
                charset = response.headers.get_content_charset() or "utf-8"
        except HTTPError as exc:
            detail = _read_http_error_body(exc)
            raise YahooEarningsCalendarFetchError(f"Yahoo request failed with HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise YahooEarningsCalendarFetchError(f"Yahoo request failed: {exc.reason}") from exc

        return _decode_response_body(body, encoding=encoding, charset=charset)


def parse_earnings_calendar_api_payload(payload: Any, fallback_day: date) -> list[EarningsCalendarEvent]:
    events: list[EarningsCalendarEvent] = []
    for item in _iter_candidate_api_events(payload):
        event = _event_from_api_item(item, fallback_day=fallback_day)
        if event is not None:
            events.append(event)
    return _dedupe_events(events)


def parse_earnings_calendar_html(html: str, fallback_day: date) -> list[EarningsCalendarEvent]:
    soup = _make_soup(html)
    events: list[EarningsCalendarEvent] = []

    for table in soup.find_all("table"):
        headers = [_clean_text(header.get_text(" ", strip=True)) for header in table.find_all("th")]
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue

            row_values = _table_row_values(headers, cells)
            event = _event_from_table_row(row_values, fallback_day=fallback_day)
            if event is not None:
                events.append(event)

    return _dedupe_events(events)


def _make_soup(html: str) -> Any:
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise YahooEarningsCalendarError(
            "beautifulsoup4 is required to parse Yahoo earnings calendar HTML"
        ) from exc

    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
        return BeautifulSoup(html, "html.parser")


def _table_row_values(headers: list[str], cells: list[Any]) -> dict[str, str]:
    row_values: dict[str, str] = {}
    for index, cell in enumerate(cells):
        header = headers[index] if index < len(headers) else ""
        aria_label = _clean_text(str(cell.get("aria-label", "")))
        key = header or aria_label or f"column_{index}"
        row_values[key] = _clean_text(cell.get_text(" ", strip=True))
    return row_values


def _event_from_table_row(row_values: dict[str, str], fallback_day: date) -> EarningsCalendarEvent | None:
    row = {_normalize_key(key): value for key, value in row_values.items()}
    symbol = _first_text(row, "symbol", "ticker")
    if symbol is None or not _looks_like_symbol(symbol):
        return None

    raw_datetime = _first_text(row, "earningsdate", "reportdate", "date")
    earnings_date = _parse_date(raw_datetime, fallback_day=fallback_day)
    earnings_date_source = "row" if raw_datetime else "fallback"

    return EarningsCalendarEvent(
        symbol=symbol.upper(),
        earnings_date=earnings_date,
        earnings_date_source=earnings_date_source,
        company_name=_first_text(row, "company", "companyname", "name"),
        earnings_datetime=raw_datetime,
        earnings_time=_first_text(row, "calltime", "time", "earningscalltime"),
        eps_estimate=_parse_float(_first_text(row, "epsestimate", "epsest")),
        reported_eps=_parse_float(_first_text(row, "reportedeps", "epsactual", "actualeps")),
        surprise_pct=_parse_float(_first_text(row, "surprisepct", "surprisepercent", "surprise")),
    )


def _iter_candidate_api_events(payload: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if _looks_like_api_event(value):
                candidates.append(value)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(payload)
    return candidates


def _looks_like_api_event(value: dict[str, Any]) -> bool:
    keys = {_normalize_key(key) for key in value.keys()}
    if "symbol" not in keys and "ticker" not in keys:
        return False
    earnings_keys = {
        "startdatetime",
        "earningsdate",
        "epsestimate",
        "reportedeps",
        "epsactual",
        "epssurprisepct",
        "companyshortname",
        "companyname",
    }
    return bool(keys & earnings_keys)


def _event_from_api_item(item: dict[str, Any], fallback_day: date) -> EarningsCalendarEvent | None:
    row = {_normalize_key(key): value for key, value in item.items()}
    symbol = _first_text(row, "symbol", "ticker")
    if symbol is None or not _looks_like_symbol(symbol):
        return None

    raw_datetime = _first_text(row, "startdatetime", "earningsdate", "eventdatetime")
    earnings_date = _parse_date(raw_datetime, fallback_day=fallback_day)
    earnings_date_source = "row" if raw_datetime else "fallback"

    return EarningsCalendarEvent(
        symbol=symbol.upper(),
        earnings_date=earnings_date,
        earnings_date_source=earnings_date_source,
        company_name=_first_text(row, "companyshortname", "companyname", "shortname", "name"),
        earnings_datetime=raw_datetime,
        earnings_time=_first_text(row, "time", "timetype", "calltime"),
        eps_estimate=_parse_float(_first_text(row, "epsestimate", "epsest")),
        reported_eps=_parse_float(_first_text(row, "reportedeps", "epsactual", "actualeps")),
        surprise_pct=_parse_float(_first_text(row, "epssurprisepct", "surprisepct", "surprise")),
    )


def _dedupe_events(events: list[EarningsCalendarEvent]) -> list[EarningsCalendarEvent]:
    deduped: dict[tuple[str, date, str | None], EarningsCalendarEvent] = {}
    for event in events:
        key = (event.symbol, event.earnings_date, event.earnings_datetime)
        deduped[key] = event
    return list(deduped.values())


def _decode_response_body(body: bytes, encoding: str, charset: str) -> str:
    normalized_encoding = encoding.lower()
    if "gzip" in normalized_encoding:
        body = gzip.decompress(body)
    elif "deflate" in normalized_encoding:
        body = zlib.decompress(body)
    return body.decode(charset, errors="replace")


def _read_http_error_body(exc: HTTPError) -> str:
    try:
        body = exc.read()
    except Exception:
        return ""
    encoding = exc.headers.get("Content-Encoding", "")
    charset = exc.headers.get_content_charset() or "utf-8"
    return _decode_response_body(body, encoding=encoding, charset=charset).strip()[:200]


def _first_text(row: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = row.get(key)
        text = _clean_text(value)
        if text:
            return text
    return None


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _looks_like_symbol(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9.\-]{0,23}", value.upper()))


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    stripped = value.strip()
    if stripped in {"", "-", "--", "N/A", "n/a"}:
        return None
    stripped = stripped.replace("%", "").replace(",", "").replace("$", "")
    try:
        return float(stripped)
    except ValueError:
        return None


def _parse_date(value: str | None, fallback_day: date) -> date:
    if value is None:
        return fallback_day

    text = value.strip()
    if not text:
        return fallback_day

    if text.isdigit():
        timestamp = int(text)
        if timestamp > 10_000_000_000:
            timestamp = timestamp // 1000
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).date()

    iso_text = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(iso_text).date()
    except ValueError:
        pass

    month_date_match = re.search(
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b",
        text,
        flags=re.IGNORECASE,
    )
    if month_date_match is not None:
        text = month_date_match.group(0)

    numeric_date_match = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", text)
    if numeric_date_match is not None:
        text = numeric_date_match.group(0)

    for date_format in ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue

    return fallback_day


def _json_default(value: Any) -> str:
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Yahoo Finance earnings calendar rows.")
    parser.add_argument("--from-date", type=date.fromisoformat, default=date(2010, 5, 30))
    parser.add_argument("--to-date", type=date.fromisoformat, default=date(2010, 6, 5))
    parser.add_argument("--day", type=date.fromisoformat, default=date(2010, 6, 2))
    parser.add_argument("--source", choices=["auto", "api", "html"], default="auto")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    provider = YahooEarningsCalendarProvider()

    try:
        events = provider.fetch_range(
            start=args.from_date,
            end=args.to_date,
            day=args.day,
            source=args.source,
        )
    except YahooEarningsCalendarError as exc:
        print(f"Failed to fetch Yahoo earnings calendar: {exc}", file=sys.stderr)
        return 1

    print(json.dumps([asdict(event) for event in events], default=_json_default, indent=2))
    if not events:
        print("No earnings rows found in Yahoo response.", file=sys.stderr)
    elif all(event.earnings_date_source == "fallback" for event in events):
        print(
            "Warning: Yahoo rows did not include row-level dates; earnings_date is the requested fallback date.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
