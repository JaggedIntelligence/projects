#!/usr/bin/env python3

import yfinance as yf

# 1. Create a Ticker object
ticker = yf.Ticker("AMD")

# 2. Get all available expiration dates
expirations = ticker.options  
print("Expirations:", expirations)

# 3. Fetch the option chain for a specific expiration date (e.g., the first one)
opt = ticker.option_chain(expirations[0])

# 4. Access calls and puts dataframes
calls_df = opt.calls
puts_df = opt.puts

print(calls_df.head())


# ---------- Extract the EPS Trend data as a DataFrame
eps_trend_df = ticker.eps_trend
print(eps_trend_df)

eps_dict = ticker.get_eps_trend(as_dict=True)
print(eps_dict)

# Extract the Revenue and Earnings Estimate data
revenue_estimates_df = ticker.earnings_estimate
print(revenue_estimates_df)