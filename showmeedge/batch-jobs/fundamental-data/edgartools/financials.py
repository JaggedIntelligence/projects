#!/usr/bin/env python3

"""Get quarterly and annual MSFT revenue, net income, and diluted EPS."""

from collections import Counter

import pandas as pd

from edgar import Company, set_identity
from edgar.xbrl import XBRLS


TICKER = "MSFT"
MAX_QUARTERLY_PERIODS = 100
MAX_ANNUAL_PERIODS = 100

set_identity("srview9@gmail.com")


METRICS = {
    "Revenue": {
        "standard_concepts": ["Revenue"],
        "concept_suffixes": [
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "SalesRevenueNet",
            "Revenues",
        ],
    },
    "Net Income": {
        "standard_concepts": ["NetIncome"],
        "concept_suffixes": ["NetIncomeLoss"],
    },
    "Diluted EPS": {
        "standard_concepts": ["EarningsPerShareDiluted"],
        "concept_suffixes": ["EarningsPerShareDiluted"],
    },
}


def period_columns(statement):
    """Return the DataFrame column name and metadata for each XBRL period."""
    periods = statement.statement_data["periods"]
    end_dates = [period_id[-10:] for period_id, _ in periods]
    end_date_counts = Counter(end_dates)

    return [
        {
            "end_date": end_date,
            "label": label,
            "column": end_date if end_date_counts[end_date] == 1 else label,
        }
        for (period_id, label), end_date in zip(periods, end_dates)
    ]


def select_metric_rows(statement_df, value_columns):
    """Select one well-populated XBRL row for each requested metric."""
    selected_rows = {}

    concepts = statement_df["concept"].fillna("").astype(str)
    standard_concepts = statement_df["standard_concept"].fillna("").astype(str)

    for metric_name, mapping in METRICS.items():
        standard_match = standard_concepts.isin(mapping["standard_concepts"])
        concept_match = concepts.str.endswith(tuple(mapping["concept_suffixes"]))
        candidates = statement_df[standard_match | concept_match].copy()

        if candidates.empty:
            continue

        candidates["_period_count"] = candidates[value_columns].notna().sum(axis=1)
        selected_rows[metric_name] = candidates.sort_values(
            "_period_count",
            ascending=False,
        ).iloc[0]

    return selected_rows


def filing_metadata(xbrls):
    """Index fiscal-year metadata by each filing's document period end."""
    metadata = {}

    for xbrl in xbrls.xbrl_list:
        entity_info = xbrl.entity_info
        period_end = entity_info.get("document_period_end_date")
        fiscal_year = entity_info.get("fiscal_year")
        fiscal_period = entity_info.get("fiscal_period")

        if period_end and fiscal_year and fiscal_period:
            metadata[str(period_end)] = {
                "Fiscal Year": int(fiscal_year),
                "Quarter": fiscal_period,
            }

    return metadata


def statement_records(statement, xbrls, wanted_periods):
    """Convert selected statement periods into one record per fiscal period."""
    statement_df = statement.to_dataframe()
    periods = period_columns(statement)
    value_columns = [period["column"] for period in periods]
    metric_rows = select_metric_rows(statement_df, value_columns)
    metadata = filing_metadata(xbrls)
    records = []

    for period in periods:
        fiscal = metadata.get(period["end_date"])
        if fiscal is None:
            continue

        period_name = period["label"].split()[0]
        if period_name not in wanted_periods:
            continue

        # Q2 and Q3 filings contain both a discrete quarter and a YTD period.
        if "YTD" in period["label"]:
            continue

        record = {
            "Fiscal Year": fiscal["Fiscal Year"],
            "Quarter": period_name,
            "Period End": pd.to_datetime(period["end_date"]),
        }

        for metric_name, row in metric_rows.items():
            record[metric_name] = row[period["column"]]

        records.append(record)

    return records


company = Company(TICKER)

quarterly_filings = company.get_filings(
    form="10-Q",
    amendments=False,
    is_xbrl=True,
)

annual_filings = company.get_filings(
    form="10-K",
    amendments=False,
    is_xbrl=True,
)

quarterly_xbrls = XBRLS.from_filings(quarterly_filings)
annual_xbrls = XBRLS.from_filings(annual_filings)

quarterly_statement = quarterly_xbrls.statements.income_statement(
    max_periods=MAX_QUARTERLY_PERIODS,
    include_quarterly=True,
)

annual_statement = annual_xbrls.statements.income_statement(
    max_periods=MAX_ANNUAL_PERIODS,
)


# Reported fiscal Q1-Q3 values from 10-Q filings.
quarterly_records = statement_records(
    quarterly_statement,
    quarterly_xbrls,
    {"Q1", "Q2", "Q3"},
)


# Reported fiscal-year values from 10-K filings.
annual_records = statement_records(
    annual_statement,
    annual_xbrls,
    {"FY"},
)

annual_df = pd.DataFrame(annual_records).drop(columns="Quarter")
annual_df["Source"] = "10-K"
annual_df = annual_df.sort_values("Fiscal Year").reset_index(drop=True)


quarters_by_year = {}

for record in quarterly_records:
    quarters_by_year.setdefault(record["Fiscal Year"], []).append(record)

for annual_record in annual_records:
    fiscal_year = annual_record["Fiscal Year"]
    first_three_quarters = quarters_by_year.get(fiscal_year, [])
    if {row["Quarter"] for row in first_three_quarters} != {"Q1", "Q2", "Q3"}:
        continue

    q4_record = {
        "Fiscal Year": fiscal_year,
        "Quarter": "Q4",
        "Period End": annual_record["Period End"],
    }

    for metric_name in ["Revenue", "Net Income"]:
        if metric_name in annual_record:
            q4_record[metric_name] = annual_record[metric_name] - sum(
                quarter.get(metric_name, 0)
                for quarter in first_three_quarters
            )

    q4_record["Source"] = "10-K derived"

    quarterly_records.append(q4_record)


quarterly_df = pd.DataFrame(quarterly_records)
quarterly_df["Source"] = quarterly_df.get("Source", "10-Q").fillna("10-Q")
quarterly_df["_quarter_number"] = quarterly_df["Quarter"].str.removeprefix("Q").astype(int)
quarterly_df = (
    quarterly_df
    .sort_values(["Fiscal Year", "_quarter_number"])
    .drop(columns="_quarter_number")
    .reset_index(drop=True)
)


print("\nQUARTERLY REVENUE, NET INCOME, AND DILUTED EPS")
print(quarterly_df.to_string(index=False))

print("\nANNUAL REVENUE, NET INCOME, AND DILUTED EPS")
print(annual_df.to_string(index=False))


quarterly_df.to_csv(
    f"{TICKER.lower()}_quarterly_revenue_netincome_eps.csv",
    index=False,
)

annual_df.to_csv(
    f"{TICKER.lower()}_annual_revenue_netincome_eps.csv",
    index=False,
)
