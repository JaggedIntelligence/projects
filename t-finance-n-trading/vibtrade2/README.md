# SR created README file

### How to run

uv run vibe-trading init  # one time Model API key setup

uv run vibe-trading  # after above to run the vibe-tradind shell

- Prompt:
❯ Backtest a BTC-USDT 20/50 moving-average strategy for 2024 and summarize return and drawdown

- SR manually copied terminal output to the file /runs/run2.md for reading purpose ..
- with OPenAI API key it costed $.8 to run this program 

### API costs
 - run1 with BTC-USD  GPT-5.6 costed $0.8
 - run2 with BTC-USD gpt-6-luna costed $.15  -- Much better 

 - run 3  AMD 1 cent for 2026
 - run 4  NVDA 1 cent for 2026 
 - run 5  BTC-USD for 2026 , just 2 cents ..

 ### Open Router Deepseek v4.1-flash Costs
  - it costed 5 cents for above BTC-USD  MA 2024 test
  - for chatgpt-6-luna it only costed 1 cent ...
  - 5x more Deepseek , no good , need to do More tests ..

sreddy@Subbas-MacBook-Air vibtrade2 % cat ~/.vibe-trading/.env

LANGCHAIN_TEMPERATURE=0.0
LANGCHAIN_PROVIDER=openrouter
OPENROUTER_API_KEY=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
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
LANGCHAIN_MODEL_NAME=deepseek/deepseek-v4.1-flash
TIMEOUT_SECONDS=120
MAX_RETRIES=2
