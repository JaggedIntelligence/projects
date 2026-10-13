# Vibe Trading

### HOW SR got this repo

1. SR got this with "Path B: local install" STEPS as mentioned IN  https://github.com/HKUDS/Vibe-Trading
2. so far got 'git clone' and commited to SR repo
3. TODO: need to other setps shown below to RUN and see

```
Path B: Local install
git clone https://github.com/HKUDS/Vibe-Trading.git
cd Vibe-Trading
python -m venv .venv

# Activate
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate.bat       # Windows CMD
# .venv\Scripts\Activate.ps1       # Windows PowerShell

pip install -e .
cp agent/.env.example agent/.env   # Edit — set your LLM provider API key
vibe-trading   

```

### What is it

https://vibetrading.wiki/home/

**Vibe-Trading: Turn market questions into runnable research.**
 - Vibe-Trading connects natural-language prompts to market data, backtests, swarm analysis, trade-journal diagnostics, and reproducible research artifacts.

 - One command to start a research workspace.
 - Every answer keeps the trail inspectable.
 - . 
 - Built for finance research, not brokerage execution.

### Docs: 1. understanding Vibe-Trading

https://vibetrading.wiki/tutorials/vibe-trading-beginner
This guide is for readers with no finance training and little trading experience. It does not teach you a “can’t-lose strategy”. Instead, **it explains what factors, strategies, backtests, data sources, broker connectors and Shadow Account are in Vibe-Trading, and how to start using them in a safe order**.