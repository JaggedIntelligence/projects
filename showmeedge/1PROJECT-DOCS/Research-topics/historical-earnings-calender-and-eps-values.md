# Companies Historical Earning calender and data extraction 


## following is Google Gemini AI answer on web

To extract historical earnings calendar and dates from Yahoo Finance, several unofficial Python libraries are available. Because Yahoo discontinued its official API in 2017, these libraries extract and parse public web data directly. [1, 2]  
Here are the most reliable Python libraries to extract this data: 

### 1. yahoo-earnings-calendar  
This is a dedicated, open-source library explicitly built for scraping the Yahoo Finance earnings calendar. It is specifically designed to fetch future and historical earnings for specific dates or ranges. 

• Key Features: Fetches earnings by date, date range, or individual tickers, and returns a structured list of dictionaries. 
• Installation:  
• Source: Available on the PyPI yahoo-earnings-calendar page. [3]  

### 2. yahooquery  
 is a robust, highly optimized Python library that interfaces directly with Yahoo Finance's internal API endpoints (which the website itself uses to render data). It natively outputs data into Pandas DataFrames. 

• Key Features: Uses the  module to extract earnings dates and integrates cleanly into Pandas for bulk data analysis. 
• Installation:  
• Source: View full documentation and endpoint examples on the yahooquery Guide. 

### 3. yahoo_fin  
This is a comprehensive, open-source Python 3 package for extracting market data, including current and past earnings calendar information. 

• Key Features: Includes the  or  modules to scrape release dates efficiently. 
• Installation:  
• Source: Read usage syntax on the Yahoo_fin Documentation. [6]  

### 4. yfinance  
While  is overwhelmingly used for historical price and fundamental data, it also includes calendar event retrieval functions (though predominantly for upcoming events). 

• Installation:  
• Source: Check for updates and features on the yfinance GitHub Repository. 

If you'd like, let me know:Are you looking to extract earnings data for a single stock or a broad watchlist?Do you need future (upcoming) dates or historical past earnings?I can show you the exact syntax for the best library fit. 
AI responses may include mistakes.

[1] https://www.interactivebrokers.com/campus/ibkr-quant-news/how-to-get-stock-earnings-data-with-python/
[2] https://python-yahoofinance.readthedocs.io/en/latest/api.html

[3] https://pypi.org/project/yahoo-earnings-calendar/
[4] https://alpha2phi.medium.com/investment-analysis-finance-libraries-1c3cb1342b3e

[5] https://github.com/dpguthrie/yahooquery
[6] https://yahooquery.dpguthrie.com/guide/ticker/modules/

[7] https://algotrading101.com/learn/yfinance-guide/
[8] https://liveproxies.io/blog/how-to-scrape-yahoo-finance

