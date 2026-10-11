from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).resolve().parents[1] / "benzinga.py"
SPEC = importlib.util.spec_from_file_location("massive_benzinga_collector", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.queries = []

    def list_benzinga_ratings(self, **query):
        self.queries.append(query)
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return iter(response)


class MidStreamFailureClient:
    def __init__(self):
        self.calls = 0

    def list_benzinga_ratings(self, **query):
        self.calls += 1
        if self.calls == 1:
            def failing_iterator():
                yield {"ticker": query["ticker"], "benzinga_id": "partial"}
                raise RuntimeError("temporary connection failure")
            return failing_iterator()
        return iter([{"ticker": query["ticker"], "benzinga_id": "final"}])


def args_for(root: Path, universe_dir: Path, **overrides):
    values = {
        "universe": "sp500_current",
        "universe_dir": universe_dir,
        "ticker": None,
        "max_symbols": None,
        "start": None,
        "end": None,
        "page_size": 50_000,
        "retry_attempts": 3,
        "retry_delay_seconds": 0.0,
        "request_delay_seconds": 0.0,
        "output_root": root,
        "run_id": "test-run",
        "resume_run": None,
        "dry_run": True,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def write_universe(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "sp500_current.csv").write_text(
        "symbol,provider_symbol,name\n"
        "AMD,AMD,Advanced Micro Devices\n"
        "BRK.B,BRK-B,Berkshire Hathaway\n",
        encoding="utf-8",
    )


class UniverseTests(unittest.TestCase):
    def test_loads_canonical_symbol_instead_of_yahoo_provider_symbol(self):
        with tempfile.TemporaryDirectory() as temporary:
            universe_dir = Path(temporary)
            write_universe(universe_dir)
            records = collector.load_symbol_universe("sp500_current", universe_dir)

        self.assertEqual([record["ticker"] for record in records], ["AMD", "BRK.B"])

    def test_select_symbols_preserves_requested_order_and_max(self):
        records = [{"ticker": "AMD"}, {"ticker": "AAPL"}, {"ticker": "MSFT"}]
        selected = collector.select_symbols(records, ["MSFT", "AMD"], max_symbols=1)
        self.assertEqual([record["ticker"] for record in selected], ["MSFT"])


class FetchTests(unittest.TestCase):
    def test_authentication_and_entitlement_errors_are_not_retryable(self):
        self.assertFalse(collector.is_retryable_error(RuntimeError("Invalid API Key")))
        self.assertFalse(collector.is_retryable_error(RuntimeError("Not entitled to this data")))
        self.assertTrue(collector.is_retryable_error(RuntimeError("connection reset")))

    def test_mid_stream_failure_restarts_symbol_without_partial_duplicates(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            destination = root / "AMD.csv"
            event_log = root / "events.jsonl"
            args = args_for(root, root)
            client = MidStreamFailureClient()

            count, attempts = collector.fetch_symbol_with_retry(
                client,
                "AMD",
                destination,
                args,
                "test-run",
                "secret-key",
                event_log,
                sleep_fn=lambda _: None,
                random_fn=lambda: 0.0,
            )
            with destination.open(newline="", encoding="utf-8") as source:
                rows = list(csv.DictReader(source))

        self.assertEqual(count, 1)
        self.assertEqual(attempts, 2)
        self.assertEqual([row["benzinga_id"] for row in rows], ["final"])
        self.assertNotIn("_ingest", rows[0])

    def test_build_query_uses_integer_page_size_and_inclusive_dates(self):
        args = SimpleNamespace(page_size=50_000, start=date(2026, 7, 1), end=date(2026, 7, 21))
        self.assertEqual(
            collector.build_query(args, "amd"),
            {
                "ticker": "AMD",
                "limit": 50_000,
                "sort": "last_updated.asc",
                "date_gte": "2026-07-01",
                "date_lte": "2026-07-21",
            },
        )


class CollectionTests(unittest.TestCase):
    def test_resume_restores_original_query_dates_and_page_size(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            universe_dir = base / "universes"
            runs_dir = base / "runs"
            write_universe(universe_dir)
            initial_args = args_for(
                runs_dir,
                universe_dir,
                start=date(2026, 7, 1),
                end=date(2026, 7, 21),
                page_size=123,
            )
            run_dir, _, _, _ = collector.prepare_run(initial_args)
            resume_args = args_for(
                runs_dir,
                universe_dir,
                run_id=None,
                resume_run=run_dir,
                start=None,
                end=None,
                page_size=50_000,
            )

            collector.prepare_run(resume_args)

        self.assertEqual(resume_args.start, date(2026, 7, 1))
        self.assertEqual(resume_args.end, date(2026, 7, 21))
        self.assertEqual(resume_args.page_size, 123)

    def test_run_writes_artifacts_and_resume_skips_completed_symbols(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            universe_dir = base / "universes"
            runs_dir = base / "runs"
            write_universe(universe_dir)
            args = args_for(runs_dir, universe_dir)
            first_client = FakeClient(
                [
                    [
                        {
                            "ticker": "AMD",
                            "benzinga_id": "amd-1",
                            "price_target": 200,
                            "benzinga_calendar_url": "https://example.test/calendar",
                            "benzinga_news_url": "https://example.test/news",
                            "analyst": {"name": "Example Analyst"},
                        },
                        {
                            "ticker": "AMD",
                            "benzinga_id": "amd-2",
                            "rating_action": "Maintains",
                        },
                    ],
                    [],
                ]
            )

            first_summary = collector.run_collection(
                args, first_client, "secret-key", sleep_fn=lambda _: None, random_fn=lambda: 0.0
            )
            run_dir = runs_dir / "test-run"
            resume_args = args_for(runs_dir, universe_dir, run_id=None, resume_run=run_dir)
            second_client = FakeClient([])
            second_summary = collector.run_collection(
                resume_args, second_client, "secret-key", sleep_fn=lambda _: None, random_fn=lambda: 0.0
            )
            with (run_dir / "AMD.csv").open(newline="", encoding="utf-8") as source:
                amd_rows = list(csv.DictReader(source))
            records_per_symbols = json.loads(
                (run_dir / "records_per_symbols.json").read_text(encoding="utf-8")
            )
            no_data_csv_exists = (run_dir / "BRK.B.csv").is_file()
            no_data_csv_content = (run_dir / "BRK.B.csv").read_text(encoding="utf-8")
            combined_jsonl_exists = (run_dir / "rows.jsonl").exists()
            symbols_directory_exists = (run_dir / "symbols").exists()

        self.assertTrue(first_summary["complete"])
        self.assertEqual(first_summary["symbols_succeeded"], 1)
        self.assertEqual(first_summary["symbols_no_data"], 1)
        self.assertEqual(first_summary["records_written"], 2)
        self.assertTrue(second_summary["complete"])
        self.assertEqual(second_summary["symbols_already_complete"], 2)
        self.assertEqual(second_client.queries, [])
        self.assertEqual([row["benzinga_id"] for row in amd_rows], ["amd-1", "amd-2"])
        self.assertEqual(amd_rows[0]["analyst"], '{"name":"Example Analyst"}')
        self.assertIn("rating_action", amd_rows[0])
        self.assertNotIn("_ingest", amd_rows[0])
        self.assertNotIn("benzinga_calendar_url", amd_rows[0])
        self.assertNotIn("benzinga_news_url", amd_rows[0])
        self.assertEqual(records_per_symbols, {"AMD": 2, "BRK.B": 0})
        self.assertTrue(no_data_csv_exists)
        self.assertEqual(no_data_csv_content, "")
        self.assertFalse(combined_jsonl_exists)
        self.assertFalse(symbols_directory_exists)


if __name__ == "__main__":
    unittest.main()
