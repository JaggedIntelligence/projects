# Other trading soruce that can be levaraged for ShowMeEdge


### //HKUDS/Vibe-trading/ project

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


## Ai4Trade project

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