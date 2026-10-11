#!/usr/bin/env python3

import yfinance as yf

# 1. Create a Ticker object
apple = yf.Ticker("AMD")

# 2. Get all available expiration dates
expirations = apple.options  
print("Expirations:", expirations)

# 3. Fetch the option chain for a specific expiration date (e.g., the first one)
opt = apple.option_chain(expirations[0])

# 4. Access calls and puts dataframes
calls_df = opt.calls
puts_df = opt.puts

print(calls_df.head())