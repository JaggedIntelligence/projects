# AI role in Trading



## My honest experience after a year Vibe Trading with AI

Reddit post
https://www.reddit.com/r/ai_trading/comments/1v8xyz1/my_honest_experience_after_a_year_vibe_trading/

r/ai_trading
•3mo ago
u/LeastTangelo6022

The truth about AI trading after a year testing.

I've been building and testing trading algos with AI almost every day for close to a year. Thousands of strategies and backtests, around hundreds of strategy families, multiple live systems.

### Here's what nobody selling you an "AI trading bot" will tell you.

First, there are 7 different ways to use AI in trading:
```
An LLM trades on its own

An LLM analyzes the market and recommends trades

An LLM helps you build and test a strategy

An LLM sits inside a deterministic strategy as an extra filter layer

LLM simulated environments (a la MiroFish) where the aggregate is used as a signal

Classical ML on top of your strategy (the Lopez de Prado pipeline: random forest, XGBoost, LightGBM)

Training your own transformer on proprietary data
```

These are completely different things. Mixing them up is why most "AI trading" takes are garbage.

### What does NOT work:

> Letting an LLM trade or recommend trades. I ran ensembles of LLM agents predicting 1h, 4h and 24h direction. The win rate differences were pure bias and regime artifacts. Last month's best agent was noise.

> Training your own transformer. Unless you have truly proprietary data at scale, you're paying GPU bills to overfit.

>Looking for the infinite money glitch on a single asset with a single method.

>"Claude, build me a profitable strategy." It grabs some data, overfits, tests 50 hypotheses and hands you survivorship bias with a smile. Add ML on top and you get look ahead bias, leaky labels and no real out of sample. I ran this experiment properly. Thousands of backtests, hundreds of strategy families, frontier models. Strategies that survived honest validation with Sharpe above 0.8: zero.

The models aren't dumb. Markets are just efficient, and AI is the most convincing overfitting machine ever built.

### What DOES work:

> LLM as the engineer, not the trader. Build deterministic strategies, formalize hypotheses, iterate fast, but you own the validation.

> LLM as one filter layer inside a rule based system (including simulated environments as that filter). The strategy has to work without it too.

> The Lopez de Prado pipeline on top of an already working strategy. Purged cross validation, walk forward, deflated Sharpe. And still treat it as experimental until it survives out of sample.

> Deploy lots of paper trading agents and let live performance rank them over weeks. Time beats backtests.

> Copy trading as a feature inside your strategy. Validate your entries against what proven wallets are actually doing.
--> Reality check: on the whole Hyperliquid leaderboard, the number of traders you can actually mirror is maybe 15 to 30. The rest are HFT you physically can't copy.

The pattern is simple. AI accelerates the process, you own the edge through validation. The moment AI owns the edge, you own the losses.