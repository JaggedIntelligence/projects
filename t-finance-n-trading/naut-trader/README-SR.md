# Nautilus Trader

### How I got the installation of the Nautilus trader python package
 - many manual attempts from github repo instrucitons failed'
 - finally asked  Codex to create a sample pyproject.toml for Natilus trader 
 - few errors
 - asked to fix , it did

### how to run

uv sync 

uv run python -m naut_trader.main

uv run  naut_trader

### see the scirpts in .toml file 

this how you create scripts in .toml file for EACH major program ( your own project module ) so you run as
uv run  naut_trader

```
[project.scripts]
naut-trader = "naut_trader.main:main"
naut-backtest = "naut_trader.backtests.high_level:main"

```