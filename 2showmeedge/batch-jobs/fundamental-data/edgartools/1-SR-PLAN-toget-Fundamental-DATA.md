# SR note: PLAN to get Fundamental DATA


### Better Plan to get FUNDAMENTAL DATA than getting from EDGAR Tools
  1/ It is worth paying this $29 one time fee and get these DATA from Massive.com 
  2/ store the Data into QuestDB
  2.2/ after ONE MOnth of getting all the DATA on ALL companies, discontinue and get DATA from YAHOO FINance SCRAPE
  
  3/ SCRAPE Yahoo finance for DAILY updates: then ask Codex to develop scirpt to scrape  "Yahoo finance " fundamental Data SCAPE and insert into same QuestDB ... ( include source filed:   1 - 'massive' , 2 'yahoo finance" ) 

### problem with gettting FUNDAMENTAL DATA FROM Edgar tools github repo based package.
    - Edgar Tools are GOOD if you wanted to get few years of DATA ( as shown on github repo)
    - but if **you need to get 10+ years of DATA**, you need to parse INDIVIDUAL 10-Q 10-K ( annual) Files
    - those files have Inconsistent DATA Field Names , Banks use different names, Tech companies use differnetn names for certain colummns/attributes.
    - so it is all messy, the Codex Answer is docuemented in the file 'DATE-Consistency-problems*.md" 

  
### DETAILS  on how to get FUNDAMENTAL DATA FROM Massive.com subscrition , it is $29/month
----
Financials & Ratios
Get company financials and key ratios without a stocks subscription.
$29/month

Free / Basic plans: 5 API requests per minute.
Paid plans (Starter and up): unlimited API requests for the asset class you subscribe to.

There isn’t a strict hard cap for paid plans, but usage is monitored. 

To avoid throttling, it’s recommended to keep requests under about 100 per second. 
-------

Yes. The Financials & Ratios data is accessed through four REST endpoints:
Income Statements
https://massive.com/docs/rest/stocks/fundamentals/income-statements
Cash Flow Statements
https://massive.com/docs/rest/stocks/fundamentals/cash-flow-statements
Balance Sheets
https://massive.com/docs/rest/stocks/fundamentals/balance-sheets
Ratios
https://massive.com/docs/rest/stocks/fundamentals/ratios

These endpoints provide company fundamentals (income, cash flow, balance sheet, and valuation ratios) for about 6,700 public companies, with quarterly, annual, and TTM data going back to 2009 and updated daily. 

Each endpoint has its own API path, for example:
GET /stocks/financials/v1/ratios for the ratios data.

-------

Yes — the income statement data is fairly comprehensive. You do get most of the items you listed.

Included (directly available):
revenue
cost_of_revenue
gross_profit
operating_income
total_operating_expenses
other_income_expense
income_before_income_taxes
income_taxes
net_income_loss_attributable_common_shareholders
interest_income
interest_expense
diluted_earnings_per_share
diluted_shares_outstanding
basic_earnings_per_share
basic_shares_outstanding
ebitda
discontinued_operations
equity_in_affiliates
extraordinary_items
noncontrolling_interest
research_development
selling_general_administrative
other_operating_expenses
consolidated_net_income_loss
filing_date, fiscal_year, fiscal_quarter, period_end 