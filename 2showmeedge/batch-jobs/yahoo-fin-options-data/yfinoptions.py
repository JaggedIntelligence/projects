#!/usr/bin/env python3

import yfinance as yf

# ---- Source Code: got all this source by just by asking Gemini ------
# Prmompt : how to extract yahoo finance EPS Trend data using python lib

# -------  company  stats
def company_stats(ticker_symbol):
    dat = yf.Ticker(ticker_symbol)
    print("----Info:\n", dat.info)
    print("-------calendar:\n", dat.calendar)
    print("-------analyst_price_targets:\n", dat.analyst_price_targets)
    print("-------quarterly_income_stmt:\n", dat.quarterly_income_stmt)
    print("-------News :\n", dat.get_news(count=100))  # --- stock news ---------

# ---- get Options data 
def get_optionschain(ticker_symbol):

    # 1. Create a Ticker object
    ticker = yf.Ticker(ticker_symbol)

    # 2. Get all available expiration dates
    expirations = ticker.options  
    print("Expirations:", expirations)

    # 3. Fetch the option chain for a specific expiration date (e.g., the first one)
    opt = ticker.option_chain(expirations[0])

    # 4. Access calls and puts dataframes
    calls_df = opt.calls
    puts_df = opt.puts

    print(f"----------- Options Chian for :{ticker_symbol}")
    print(calls_df.head())

    # ALL Apis https://ranaroussi.github.io/yfinance/reference/api/yfinance.Calendars.html#yfinance.Calendars
    calendars = yf.Calendars() 
    df_econevents_cal = calendars.get_economic_events_calendar(limit=100)
    print("\n------------ Economic Events Calender\n", df_econevents_cal)


# ---------- Extract the EPS Trend data as a DataFrame
def get_financials(ticker_symbol):

    ticker = yf.Ticker(ticker_symbol)

    # Extract the Revenue and Earnings Estimate data
    revenue_estimates_df = ticker.revenue_estimate
    print("\n----- Revenue Estimate:-------\n", revenue_estimates_df)

    # Extract the Revenue and Earnings Estimate data
    eps_estimates_df = ticker.earnings_estimate
    print("\n----- EPS Estimate:-------\n",eps_estimates_df)

    eps_trend_df = ticker.eps_trend
    print("\n----- EPS Trend:-------\n",eps_trend_df)

    eps_revisions_df = ticker.eps_revisions
    print("\n----- EPS REVISIONS:-------\n",eps_revisions_df)

    growth_estimates_df = ticker.growth_estimates
    print("\n----- growth_estimates:-------\n",growth_estimates_df)


    eps_dict = ticker.get_eps_trend(as_dict=True)
    print(eps_dict)


    # 1. Get industry information
    industry = ticker.info.get("industry")
    sector = ticker.info.get("sector")

    print(f"{ticker_symbol}: Sector: {sector} | Industry: {industry}")


# --- main ----------
get_optionschain("AMD")
get_financials("AMD")

get_financials("AMZN")

get_financials("EBAY")

company_stats("AMD")