# ---------------------------------------------------------
"""

https://vectorbt.pro/features/portfolio/#contract-multiplier

when using in Google Colab, insert these two in First CELL 
!pip install vectorbt
!pip install pandas

"""
# ---------------------------------------------------------

import vectorbt as vbt
import pandas as pd


# ---- Level 2 back testing ------------------------------------------------------------
def backtest_level2():
  data = vbt.YFData.download("AMD", start="2015", end="2026")  

  fast_sma = data.run("talib_func:sma", timeperiod=10)  
  slow_sma = data.run("talib_func:sma", timeperiod=30)
  entries = fast_sma.vbt.crossed_above(slow_sma)
  exits = fast_sma.vbt.crossed_below(slow_sma)

  pf = vbt.Portfolio.from_signals(  
      data,
      entries=entries,
      exits=exits,
      size=1,
      init_cash=100_000,
  )

  # 4. Analyze
  print(pf.stats())
  pf.plot().show()




# ---- Level 1 back testing ------------------------------------------------------------
def backtest_level1():
  # 1. Get Data
  #price = vbt.YFData.download('BTC-USD').get('Close')
  data = vbt.YFData.download("AMD", start="2015", end="2026")  

  # Use .get() to extract the Close prices (or whatever column you need)
  price = data.get('Close')

  # 2. Define Strategy (e.g., Price > 50-day Moving Average)
  ma50 = vbt.MA.run(price, 50).ma
  entries = price > ma50
  exits = price < ma50

  # 3. Create the vbt.PF (Portfolio) object
  pf = vbt.Portfolio.from_signals(price, entries, exits, init_cash=10000)

  # 4. Analyze
  print(pf.stats())
  pf.plot().show()



# ----------------- main --------------------------------
if __name__ == "__main__":
  backtest_level1()
