#!/usr/bin/env python3

"""Get MSFT revenue, net income, and EPS from historical 10-Q filings."""

import re
import pandas as pd

from edgar import Company, set_identity
from edgar.xbrl import XBRLS


TICKER = "MSFT"

set_identity("srview9@gmail.com")

company = Company(TICKER)


# ---------------------------------------------------------
# Get all original XBRL 10-Q filings
# ---------------------------------------------------------
filings = company.get_filings(
    form="10-Q",
    amendments=False,
    is_xbrl=True,
)

if filings is None or len(filings) == 0:
    raise RuntimeError(f"No 10-Q XBRL filings found for {TICKER}")


# ---------------------------------------------------------
# Stitch all quarterly filings
# ---------------------------------------------------------
xbrls = XBRLS.from_filings(filings)

income_statement = xbrls.statements.income_statement(
    max_periods=100,
)

income_df = income_statement.to_dataframe()

print("\nFULL QUARTERLY INCOME STATEMENT")
print(income_df.to_string(index=False))


# ---------------------------------------------------------
# Identify period columns such as 2025-09-30
# ---------------------------------------------------------
period_columns = [
    column
    for column in income_df.columns
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(column))
]

if not period_columns:
    raise RuntimeError(
        "No quarterly date columns were found.\n"
        f"Available columns: {income_df.columns.tolist()}"
    )


# ---------------------------------------------------------
# Metrics to extract
# ---------------------------------------------------------
metric_names = {
    "Revenue": "Revenue",
    "NetIncome": "Net Income",
    "EarningsPerShareDiluted": "Diluted EPS",
}

selected = income_df[
    income_df["standard_concept"].isin(metric_names.keys())
].copy()

if selected.empty:
    print("\nAvailable standardized concepts:")
    print(
        income_df[
            ["label", "concept", "standard_concept"]
        ].to_string(index=False)
    )

    raise RuntimeError(
        "Revenue, net income, or diluted EPS concepts were not found."
    )


# A company may have multiple rows mapped to the same standardized
# concept. Keep the row with the greatest historical coverage.
selected["_period_count"] = (
    selected[period_columns]
    .notna()
    .sum(axis=1)
)

selected = (
    selected
    .sort_values("_period_count", ascending=False)
    .drop_duplicates(subset="standard_concept")
)


# ---------------------------------------------------------
# Convert metrics from rows to columns
# ---------------------------------------------------------
quarterly_df = (
    selected
    .set_index("standard_concept")[period_columns]
    .transpose()
    .rename(columns=metric_names)
    .reset_index(names="Period End")
)

quarterly_df["Period End"] = pd.to_datetime(
    quarterly_df["Period End"],
    errors="coerce",
)

quarterly_df = (
    quarterly_df
    .sort_values("Period End")
    .reset_index(drop=True)
)

quarterly_df.insert(
    0,
    "Year",
    quarterly_df["Period End"].dt.year,
)

quarterly_df.insert(
    1,
    "Quarter",
    quarterly_df["Period End"].dt.quarter.map(
        lambda quarter: f"Q{quarter}"
    ),
)


# ---------------------------------------------------------
# Raw values DataFrame
# ---------------------------------------------------------
print("\nQUARTERLY RAW VALUES")
print(quarterly_df.to_string(index=False))


# ---------------------------------------------------------
# Display revenue/net income in millions
# ---------------------------------------------------------
display_df = quarterly_df.copy()

for column in ["Revenue", "Net Income"]:
    if column in display_df.columns:
        display_df[column] = (
            pd.to_numeric(display_df[column], errors="coerce")
            / 1_000_000
        )

display_df = display_df.rename(
    columns={
        "Revenue": "Revenue ($ millions)",
        "Net Income": "Net Income ($ millions)",
    }
)

print("\nQUARTERLY REVENUE, NET INCOME, AND EPS")
print(display_df.to_string(index=False))


# Save to CSV
quarterly_df.to_csv(
    f"{TICKER.lower()}_quarterly_revenue_netincome_eps.csv",
    index=False,
)


