# Other trading soruce that can be levaraged for ShowMeEdge

## Summary of topics in this page

#### SR Decision
 - do not use these repo directly as they have too much
 - use only required PARTS if  Codex did not return Code
 - these have Hardcoded DB Schemas in .py file
 - SR wants all DB schema in Drizzle modularized, FastAPI is only Backtest executing sending Results back to frontendReact which stores resuls in Drizzle ORM based PostGres DB

#### Project 1: /HKUDS/Vibe-trading/
- https://vibetrading.wiki/home/ 
- /HKUDS/Vibe-trading/ project is mainly for BACK Testing of Stocks/crypto/forex etcc..
- backtesting with vaious strageies in english
- examples as shown here https://vibetrading.wiki/home/
```
$vibe-trading run -p "Backtest BTC-USDT 20/50 MA for 2024"

route: crypto data -> strategy -> backtest -> run card

return +18.6% max drawdown -7.4%

```

#### Project 2: /HKUDS/AI-Trader
- AI-Trader is an Agent-Native Trading Platform: Exchange ideas and sharpen trading skills through AI agents!

### 1/ /HKUDS/Vibe-trading/ project

- **1/ /HKUDS is a Hongkong university projets repo**
- https://vibetrading.wiki/home/ 
- this  HKUDS/Vibe-trading is a  "FastAPI python server & React frontend" repo
- LangChain etc.. used for Routing , Good Modern ( started a month ago) to see Langchain capabilities etc..

- **2/ backtest model**
- can be used as basis for ShowMeEdge backtest DB model, to give as input to Codex ..
https://github.com/HKUDS/Vibe-Trading/blob/main/agent/backtest/models.py
- .
- run card https://github.com/HKUDS/Vibe-Trading/blob/main/agent/backtest/run_card.py
- backtest engines folder https://github.com/HKUDS/Vibe-Trading/tree/main/agent/backtest/engines
- correlation https://github.com/HKUDS/Vibe-Trading/blob/main/agent/backtest/correlation.py
- tests https://github.com/HKUDS/Vibe-Trading/blob/main/agent/tests/test_run_card.py


## 2/ Ai4Trade project

### big ides of the project
- https://github.com/HKUDS/AI-Trader
- Just like humans have their trading platforms, AI agents need their own.
- AI-Trader is an Agent-Native Trading Platform: Exchange ideas and sharpen trading skills through AI agents!
- Any AI agent joins the AI-Trader platform in seconds -- Simply send this message to your agent.


### DB Schema 
- DB Schema is defined in this file .. it is in .py files for FASTApi python server
- https://github1s.com/HKUDS/AI-Trader/blob/main/service/server/database.py
```
        CREATE TABLE IF NOT EXISTS stock_analysis_snapshots (

        CREATE TABLE IF NOT EXISTS agent_tasks (
        
        # Signals table - stores trading signals from providers
        CREATE TABLE IF NOT EXISTS signals (

        # Subscriptions table (for copy trading)
        CREATE TABLE IF NOT EXISTS subscriptions (

```