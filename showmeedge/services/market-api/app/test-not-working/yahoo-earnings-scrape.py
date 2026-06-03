import asyncio
from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

async def extract_carousel():
    # 1. Define the schema using the data-testid selector
    schema = {
        "name": "Carousel Content",
        "baseSelector": '[data-testid="carousel-container"]',
        "fields": [
            {
                "name": "raw_html",
                "selector": "",  # Empty extracts the baseSelector itself
                "type": "html"
            },
            {
                "name": "text_content",
                "selector": "", 
                "type": "text"
            }
        ]
    }

    # 2. Set up the extraction strategy
    extraction_strategy = JsonCssExtractionStrategy(schema, verbose=True)

    yahoo_earnings_calender_url = "https://finance.yahoo.com/calendar/earnings?from=2010-05-30&to=2010-06-05&day=2010-06-02"

    # 3. Run the crawler
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url=yahoo_earnings_calender_url,
            extraction_strategy=extraction_strategy,
            bypass_cache=True
        )
        
        if result.success:
            print(result.extracted_content)
        else:
            print(f"Extraction failed: {result.error_message}")

# Run the async function
asyncio.run(extract_carousel())