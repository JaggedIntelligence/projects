"""
---------------------
# tested in Google Colab 
# code source https://www.youtube.com/watch?v=HXxHunu_Hkk 
#

Have the below as first Cell in Google Colab
!pip install backtesting

AND get Real data file from Massive.com  of AMD so we can Test Real strategy ...

"""

import pandas as pd
import datetime as dt
from backtesting import Backtest, Strategy

# 2. create a strategy class
class OpeningRangeBreakout(Strategy):
    open_range_minutes = 5 # length of the opening range
    last_minute_bar_in_opening_range = dt.time(9, 30 + open_range_minutes)

    # what do we want to initialize at the beginning
    def init(self):
        self.current_day        = None  # tracks the current day (YYYY-MM-DD)
        self.opening_range_high = None  # opening range high
        self.opening_range_low  = None  # opening range low

    # wait every day is going to have a different opening range high and low
    def _reset_range(self, day):
        self.current_day        = day
        self.opening_range_high = None
        self.opening_range_low  = None

    def next(self):
        # get the timestamp and extract the date
        t = self.data.index[-1]
        current_bar_date = t.date()
        print(t)
        print(current_bar_date)

        """
        # detect when the date changes to a new day
        if current_bar_date != self.current_day:
            self._reset_range(current_bar_date)
            print(f"new date {current_bar_date}")

        # calculate opening range
        if t.time() <= self.last_minute_bar_in_opening_range:
            print(f"{t.time()} is less than or equal to {self.last_minute_bar_in_opening_range}")
            if self.opening_range_high is not None:
                self.opening_range_high = max(self.opening_range_high, self.data.High[-1])
            else:
                self.opening_range_high = self.data.High[-1]

            if self.opening_range_low is not None:
                self.opening_range_low = min(self.opening_range_low, self.data.Low[-1])
            else:
                self.opening_range_low = self.data.Low[-1]

        # Right when the opening range closes, log the opening range high and low for debugging
        if t.time() < self.last_minute_bar_in_opening_range:
            return

        if t.time() == self.last_minute_bar_in_opening_range:
            print(f"opening range high is {self.opening_range_high}")
            print(f"opening range low is {self.opening_range_low}")

        """


# ----------------------------------------------------------------------
# 1. read a csv of minute data

test_df = pd.read_csv("LT_1min_data.csv", nrows=5)
print(test_df.columns)

# 2. read a csv of minute data
df = pd.read_csv("LT_1min_data.csv", parse_dates=['Date'], index_col='Date')
df = df.loc['2003-01-01':'2003-01-30']
# df

# 3. create a backtest, pass in data and the strategy you want to run on the data
bt = Backtest(df, OpeningRangeBreakout, cash=25_000)

# run the strategy
bt.run()

# plot ths strategy
bt.plot()
