# EDGAR Fundamental Data Exploration

This folder explores collecting Microsoft financial results from SEC XBRL filings with [`edgartools`](https://github.com/dgunning/edgartools).

## Current behavior

`financials.py` builds two pandas DataFrames for `MSFT`:

- `quarterly_df` contains fiscal Q1, Q2, Q3, and Q4 results.
- `annual_df` contains full fiscal-year results.

The selected metrics are:

- Revenue
- Net income
- Diluted earnings per share (EPS)

Revenue and net income are stored in reported dollars. Diluted EPS is stored in dollars per share.

## How quarterly results are built

Microsoft files 10-Q reports for fiscal Q1, Q2, and Q3. The script asks `edgartools` to expose the discrete quarter and YTD periods separately, then keeps only the discrete-quarter values.

Microsoft's 10-K provides the full-year values but does not expose a separate Q4 column through the stitched income statement. Q4 revenue and net income are therefore calculated as:

```text
Q4 = Full fiscal year - Q1 - Q2 - Q3
```

Q4 diluted EPS is intentionally left empty. Subtracting quarterly EPS from annual EPS is not reliable because the calculations use different weighted-average share counts.

Fiscal year and quarter labels come from each filing's XBRL metadata. They are not inferred from calendar quarters; for example, Microsoft's September period is fiscal Q1.

## Output files

Running the script writes:

- `msft_quarterly_revenue_netincome_eps.csv`
- `msft_annual_revenue_netincome_eps.csv`

The quarterly output includes a `Source` column:

- `10-Q` for reported Q1-Q3 values
- `10-K derived` for calculated Q4 values

The annual output uses `10-K` as its source.

Some older filings use different revenue concepts, so the current exploratory concept selection leaves some early revenue values empty. Q4 is produced only when the matching fiscal year has Q1, Q2, and Q3 values.

## Run

Requirements:

- `uv` 0.11.30
- Python 3.12 managed by `uv`
- Internet access to SEC filing data

From this folder:

```bash
./run.sh
```

`run.sh` executes the locked environment defined by `pyproject.toml` and `uv.lock`.

## Files

- `financials.py` — retrieves filings, extracts the metrics, derives Q4, prints both DataFrames, and saves the CSV files.
- `run.sh` — launches the Python script with `uv run --locked`.
- `pyproject.toml` — defines the Python version and direct dependency.
- `uv.lock` — pins the complete Python dependency graph.
