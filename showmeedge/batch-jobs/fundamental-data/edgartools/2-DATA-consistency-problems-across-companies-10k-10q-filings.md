No—companies do not use universal column names in 10-K and 10-Q filings.

The SEC supplies standard US-GAAP XBRL concepts, but companies may:

- Choose among several valid concepts for the same idea.
- Create company-specific extension concepts.
- Change concepts between years.
- Present different statement structures by industry.
- Omit subtotals that can be calculated from other facts.
- Use different labels even when the underlying XBRL concept is identical.

The requested field names appear to be a vendor-normalized schema similar to Yahoo Finance, not native SEC column names. Some are reported facts, while others are vendor calculations.

## Recommended architecture

Create our own canonical schema containing the 34 requested fields. For each field, define an ordered extraction policy:

1. Preferred standardized XBRL concept.
2. Alternative standard concepts.
3. Known company-specific extension mappings.
4. A calculation from other captured fields.
5. Otherwise leave the value empty.

We should not force a questionable label match merely to populate every column.

For every canonical field, the mapping registry should eventually describe:

```text
Canonical field
Candidate XBRL concepts
Calculation fallback
Applicable industries
Units
Whether Q4 can be derived
```

## Field categories

### Mostly reported XBRL facts

These commonly have SEC facts, although their actual concepts vary:

- Total Revenue
- Cost of Revenue
- Gross Profit
- Operating Expense
- Operating Income
- Pretax Income
- Tax Provision
- Earnings from Equity Interest Net of Tax
- Net Income Common Stockholders
- Basic EPS
- Diluted EPS
- Basic Average Shares
- Diluted Average Shares
- Total Operating Income as Reported
- Total Expenses
- Net Income from Continuing & Discontinued Operation
- Interest Income
- Interest Expense
- Net Interest Income
- Net Income from Continuing Operation Net Minority Interest

Even these are not guaranteed. For example, a service company might not report “Cost of Revenue,” while a bank generally does not use a traditional Revenue → Cost of Revenue → Gross Profit structure.

### Reported when available, otherwise calculated

| Canonical field | Possible fallback |
|---|---|
| Gross Profit | Revenue − Cost of Revenue |
| Operating Expense | Gross Profit − Operating Income |
| Net Non-Operating Interest Income Expense | Interest Income − Interest Expense |
| Net Income Common Stockholders | Net income attributable to parent − preferred dividends |
| Diluted NI Available to Common Stockholders | Common-stockholder income plus dilution adjustments |
| EBIT | Pretax Income + Interest Expense |
| EBITDA | EBIT + Depreciation and Amortization |
| Tax Rate for Calcs | Tax Provision ÷ Pretax Income |

“Other Income Expense” is more difficult because companies group interest, investment gains, foreign-exchange effects, and other items differently. We should prefer a reported total and only calculate it when the component definitions are compatible.

### Vendor-defined or normalized analytics

These generally are not standard SEC income-statement facts:

- Average Dilution Earnings
- Normalized Income
- Reconciled Cost of Revenue
- Reconciled Depreciation
- Total Unusual Items Excluding Goodwill
- Total Unusual Items
- Normalized EBITDA
- Tax Effect of Unusual Items

These require us to create explicit business definitions. For example:

```text
Normalized Income
= Net Income Common Stockholders
− after-tax unusual gains
+ after-tax unusual expenses
```

But we must first decide what qualifies as “unusual”: restructuring, impairment, litigation, acquisition costs, asset-sale gains, goodwill impairment, and so on. Different financial-data vendors make different decisions here.

Therefore, exact agreement with Yahoo Finance or another vendor cannot be guaranteed using SEC facts alone.

## Recommended DataFrames

Keep the values in a wide dataset:

```text
fundamentals_df
```

One row per company and fiscal period:

```text
Symbol
CIK
Fiscal Year
Fiscal Quarter
Period End
Form
Total Revenue
Cost of Revenue
...
Normalized EBITDA
```

Also maintain a long provenance dataset:

```text
provenance_df
```

Example:

| Symbol | Fiscal Year | Quarter | Field | Value | Source type | XBRL concept/formula |
|---|---:|---|---|---:|---|---|
| MSFT | 2026 | Q1 | Total Revenue | … | Reported | RevenueFromContract… |
| MSFT | 2026 | Q4 | Total Revenue | … | Derived | FY − 9M YTD |
| MSFT | 2026 | Q4 | Diluted EPS | null | Unavailable | Not safely derivable |

This provenance will be extremely useful when two companies produce unexpected results.

## Q4 rules

For additive income-statement fields, prefer:

```text
Q4 = Full-year 10-K value − Q3 nine-month YTD value
```

This is generally safer than adding three independently selected quarter facts because both values often use the same concept and unit.

We can fall back to:

```text
Q4 = Full year − Q1 − Q2 − Q3
```

Suitable Q4 derivation candidates include:

- Revenue
- Cost of Revenue
- Gross Profit
- Operating Expenses
- Operating Income
- Interest Income and Expense
- Pretax Income
- Tax Provision
- Net Income
- EBIT
- EBITDA, if all components are available

Do not derive these by annual subtraction:

- Basic EPS
- Diluted EPS
- Basic Average Shares
- Diluted Average Shares
- Tax Rate

They are ratios or weighted averages rather than additive flows.

## Industry differences

A single mapping cannot work equally well across all companies:

- Banks: interest income, interest expense, net interest income, and non-interest income replace the normal gross-profit model.
- Insurers: premiums, policy benefits, underwriting expenses, and investment income dominate.
- REITs: funds from operations and real-estate depreciation are important.
- Industrial and technology companies: the conventional revenue/gross-profit/operating-income model works relatively well.
- Foreign issuers: may file 20-F/6-K using IFRS rather than 10-K/10-Q using US GAAP.

For the initial exploration, I recommend supporting US domestic non-financial companies first. Banks, insurers, REITs, and foreign issuers can initially be flagged or skipped.

## Practical rollout

Start with approximately 15 core fields:

- Revenue
- Cost of Revenue
- Gross Profit
- Operating Expense
- Operating Income
- Pretax Income
- Tax Provision
- Net Income Common Stockholders
- Basic and Diluted EPS
- Basic and Diluted Average Shares
- Interest Income
- Interest Expense
- Total Expenses

Test these against a small symbol set from several industries. Record missing and unmapped concepts, then expand the mapping registry.

After the reported facts are reliable, add EBIT and EBITDA. Add normalized income, unusual items, and other vendor-style fields last because those require subjective definitions.

No code or files were changed.
