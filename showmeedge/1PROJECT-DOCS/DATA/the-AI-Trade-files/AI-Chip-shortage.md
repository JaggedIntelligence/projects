### The AI Chip Shortage Nobody Is Talking About

### big picture

Source
https://x.com/tengyanAI/status/2061250957619736592

Dated :  MAY 31st
SR NOte: see How prices chaged from JUNE 1st
 - seems Micron MU is 960 on June 1st

 That was  May 31st  Story ,  when Micron was 940 , then raised to 1200 , now back to  740  on  JULY 30th -- all in 2 months period.

 **TODAY is on JULY 30** , Micron dropped to $830? on AI-trade-wind-down due to Korea KOSPI crash , hence SK hynix Crash, which is imported to  'all US AI-trade players'

### article text
Agents make GPUs need more CPUs. CPUs need scarce memory, wafers, and packaging. The trade is the bottleneck stack around the CPU. 
And the CPU trade is actually an EXTENSION of the Memory Trade (higher for longer). I'll explain why here.

https://x.com/tengyanAI/status/2061250957619736592

----
At the end of March this year, a CPU company launched a new CPU. It named it the "AGI CPU."
Okay. A CPU company launching a new CPU. How is this a big deal?
Fair question. Except this one came from Arm, a company that, in 35 years, had never really sold CPUs.
ARM is usually the third name in the data center CPU conversation, alongside Intel and AMD. But unlike the other two, ARM doesn't build chips. They design CPU architectures and license them to the companies that do the building like AWS Graviton, Microsoft Cobalt, Google Axion, NVIDIA Grace, and so on.
So when a 35-year-old licensing business pivots to selling finished silicon directly into the data center, that's a signal worth paying attention to.

From Arm Everywhere event in March 2026.
When ARM announced the launch on March 24, they said they already had $1 billion of customer demand lined up for the new product. Six weeks later, on their earnings call, that number had jumped to $2 billion.
2x in six weeks. Does that mean the new CPU is twice as good as everyone thought?
Not really. It's more likely that data center CPU demand is just so high right now that customers are grabbing anything they can get.
And ARM isn't the only company that suddenly looks different in the CPU business.
Days before its earnings call this week, NVIDIA hand-delivered the first standalone Vera CPUs to its partners like SpaceX, OpenAI, Anthropic, and others, marking the chip's move into production.
When two companies that had no business selling data center CPUs start doing exactly that in the same quarter, the market is telling you something: CPU has become critical to modern AI infrastructure in a way it simply wasn't a few years ago.
And the thing driving it is the explosive growth of agentic AI.
Note: This research was first published on Tessara Research's website in May: https://research.tessara.tech/p/cpus-the-other-chip-shortage (free, AI supply chain research)
Our view:
Tessara’s Server CPU earnings cohort analysis flagged the inflection this quarter, and spurred us to write this thesis out in full.

All four major CPU names revised the opportunity upward. All four pointed to agentic workloads. And the CPU-to-GPU ratio language moved in the same direction: from roughly 1:8 historically toward parity.
The demand signal is clear. The supply side was already flashing.
That is the setup.
AI agents turn the CPU from a background host into a scaling layer for the data center. That is driving an explosion in server CPU demand.
The problem is that this demand runs into a supply chain already stretched across leading-edge wafers, DRAM, and advanced packaging.
Meaningful relief probably does not arrive before 2028.

So the clean trade is not simply to buy CPU vendors. It is to own the scarce inputs:
TSMC for manufacturing
Micron/Samsung/SK Hynix (we outline why memory remains a layup trade in the report)
Packaging players with clear linkage to CPU demand growth (such as Amkor/ASE)

NOTE: These numbers were from when the article was first published - prices of several of these companies have gone up significantly since then. e.g. $MU is at $971 today
Why agentic AI is a CPU story
The CPU's job in an AI data center used to be straightforward: supervise the GPU.
Load weights, schedule operations, manage memory, handle I/O. The economics were ratio-driven. One CPU for every eight to thirty-two GPUs. And nobody was designing chips specifically for the role.
What changed over the last 12–15 months is the workload itself.
Traditional inference is a clean computation. You send a prompt in, the model generates tokens out, the GPU does the heavy lifting, the CPU handles the orchestration around it. The CPU's role is bursty but bounded.
An agentic workload looks structurally different. An agent reasons across a long task. It:
Calls tools like search, code execution, browser automation, database queries.
Holds and updates state across many steps.
Makes branching decisions based on intermediate results.
Coordinates across sub-agents or processes.
Each of those steps involves logic, memory management, security enforcement,etc. Exactly the kind of work CPUs are built for. The GPU is still doing the inference inside each step, but the steps themselves are now a workload and that workload runs on CPUs.
This is where the old CPU-to-GPU ratio starts to break.
Intel’s CEO put the shift plainly in their recent earnings, the CPU-to-GPU ratio has already moved from roughly 1:8 historically to around 1:4, and in some cases 1:2 today, with the direction moving toward parity and beyond. The GPU is still the money machine, but each GPU now needs more CPU-side support to stay productive.
That matters because agentic workloads are asynchronous, bursty, and full of small coordination tasks. They do not map cleanly to a simple “one host CPU beside many GPUs” model. As agent traffic scales, the question is not just how many GPUs a data center can deploy. It is whether there are enough CPU cores, memory bandwidth, and I/O capacity to keep those GPUs fed.
This is why core count suddenly matters again. ARM’s AGI CPU ships with 136 cores, and the company believes 256 or 512 cores per chip is reachable within a few generations. NVIDIA made the same point at GTC with its dedicated 256-CPU Vera rack of 22,528 cores in one liquid-cooled system, designed to sit next to Vera Rubin GPU racks and handle the orchestration layer around them.
That is not a normal host node. It is a CPU-only rack. The old ratio framework does not really anticipate that.
Jensen Huang also reframed the economics. The cloud-era CPU was built for a world where compute was sliced up and rented. The unit of value was “dollars per core.” How many cores can I sell, and at what price?
Agents change that. They are not renting isolated cores. They want the system to finish work quickly and efficiently. The economic unit becomes tokens per dollar, or more broadly, useful AI work per dollar of infrastructure.
In that world, the CPU is judged by how well it helps the full AI system produce more output through higher token throughput, lower latency, better GPU utilization, faster tool calls, and less idle time.
That is the shift. The CPU is no longer scaling quietly as a fraction of the GPU. Agentic AI is turning CPU-side orchestration into its own workload, with its own chip, its own rack, and eventually, its own supply chain problem.
The demand signal
But how soon that "eventually" arrives depends on one thing: how fast agents are actually being adopted.
Looking at the market itself, bottom-up sizings put agentic AI at roughly $40 billion in 2026, on track for $140 billion by 2030, about 3.5x in four years. But projections are projections. The more convincing signal is what's already happening, and the clearest read on that comes from coding.
Coding agents are the most production-scale evidence of agentic AI anywhere in the stack today, and the standout is Claude Code, which crossed roughly $1 billion in annualized revenue within six months of launch (and now at a whopping $30 billion+ annual run rate)
Daily commits made through Claude Code have grown more than 4000x since the tool launched in February 2025, with most of the acceleration arriving after the February 2026 launch of Claude Opus 4.6.
And it isn't one tool. PyPI install volumes across the six major agent frameworks (LangChain, LangGraph, pydantic-ai, openai-agents, browser-use, and CrewAI) are all accelerating in parallel, indicating a broad-based toolchain adoption.
Coding is only one agentic workload, but it's a clean read on the shape of all of them. A loop of read, run, test, refactor, commit, where every step is a bursty, branching, CPU-bound task gated by a tool call. Other workloads are earlier, but they run the same way
Each of those agents spends most of its life coordinating tools. And that coordination runs on a CPU.
The earnings back it up
All four data center CPU names told a version of the same story this quarter.
Intel: Data center and AI revenue beat guidance by . CEO Lip-Bu Tan described unmet demand as a number that "starts with a B" and raised OpEx guidance for the second straight quarter to fund the engineering behind it.
AMD: Data center revenue up 57%, with next quarter guided even higher. The bigger signal was CEO Lisa Su roughly doubling her TAM outlook to $120B, pinning the acceleration on a new demand category: agentic workloads.
ARM: Royalty revenue from data center chips more than doubled and is expected to double again. ARM is approaching 50% share at top hyperscalers, with the CEO saying the industry has probably undercalled CPU demand for this transition.
NVIDIA: Jensen Huang confirmed a $20B revenue trajectory for standalone Vera CPUs, potentially making NVIDIA the world's largest CPU supplier, on a $200B TAM "we have never addressed before."
From Server CPUs earnings cohort on Tessara
Four companies, four different starting points but one direction: supply-constrained today, TAMs revised up, and every one of them pointing at the same driver. Our own estimates: the clean growth case of CPU TAM is 3x to 5x (from ~$30B today) to 2030. The aggressive vendor case is 7x. Huge.
Who actually builds the CPUs
The earnings tell you demand is real. The harder question is whether supply can answer it. That starts with a simple fact: very few companies actually build data center CPUs.
Intel is the exception. It designs and manufactures Xeon in its own fabs, making it the last true integrated device maker at scale in the data center CPU market.
Almost everyone else is fabless. AMD designs EPYC and manufactures at TSMC. NVIDIA’s Vera CPU is built at TSMC. The major hyperscaler Arm CPUs, including AWS Graviton, Microsoft Cobalt, and Google Axion, are in-house designs manufactured externally, with TSMC carrying much of the leading-edge load. Qualcomm’s latest data center return also points back to TSMC.
To a first approximation, the CPU supply question is a TSMC capacity question and we'll return to whether that capacity can keep up. First, the competitive picture.
Three names dominate, and they're moving fast in different directions:
Intel still ships the most data center CPUs today, around 55% of units in Q1 2026. But it is bleeding share fast. That figure was 64% a year earlier. This is mainly due to new data center choosing ARM-based architecture over x86.
AMD has taken roughly 33% of units and a record 46% of x86 server CPU revenue. The gap between those two numbers telling you EPYC is disproportionately winning at the high end.
ARM-based chips have jumped to about 18% of units, and UBS expects 40–45% by 2030 as the overall server CPU market grows roughly fivefold, toward $170 billion.
Data center CPU market share among x86 and ARM CPUs
A significant part of that ARM‑share growth will come from NVIDIA’s aggressive push into standalone CPUs, because NVIDIA’s Vera CPU is itself an ARM‑architecture processor. Vera runs NVIDIA’s custom Olympus cores, built on the Arm v9.2‑compatible instruction set, so every Vera CPU sold adds to ARM’s footprint in the data center.
With regards to the margins these CPU suppliers make, NVIDIA gross margins around 75% (this is overall margins, not just CPUs). AMD's blended margin sits in the mid-50s and Intel's has fallen near 30%. A data center GPU is simply worth far more per wafer than a data center CPU.
So when a fabless designer like AMD today, or NVIDIA tomorrow with Vera, has to split a fixed TSMC allocation, the incentive is obvious: prioritize the highest-value silicon first. That means GPUs get protected. CPUs get whatever capacity is left after the more profitable accelerator roadmap is secured.
That is what makes this shortage harder to solve. CPU demand is rising at the same time CPU supply is competing for wafers, memory, packaging, and engineering focus against the most profitable product in semiconductors.
And the strain is already showing. Intel has called its own Xeon line supply-constrained. ARM can only ship about half the AGI CPU demand it's sitting on. Analysts flagged acute server CPU shortages on AMD’s latest quarter. All of that before the agentic wave has fully arrived.
So what does this mean for the supply chain?
CPU demand is rising fast, agentic adoption is the driver, and the trajectory only gets steeper. So what does this mean for a supply chain already pulled to its limits by the GPU buildout?
1. Memory: the LPDDR5X squeeze
The CPU bull case is also a memory bull case. NVIDIA is about to pull phone memory into AI racks at data-center scale.
An agentic CPU holds state across long tasks, manages growing context, and offloads KV-cache for the GPUs it orchestrates.
All of that runs on DRAM. DDR5 for AMD and Intel, LPDDR5X for NVIDIA's Vera. CPU memory has become a primary line item, bidding into a market already in its worst shortage in over a decade.
DRAM prices have roughly doubled since the start of 2026, with further increases expected. The HBM-to-DRAM price premium has compressed to its lowest level ever (from over 18x to under 3x), meaning conventional memory is catching up to HBM in pricing pressure.
The non-consensus risk is LPDDR5X.
NVIDIA's Vera uses LPDDR5X, the low-power memory family built for smartphones. A premium phone carries around 16GB. A single Vera CPU carries up to 1.5TB, roughly 3,375 phones' worth per rack.
Citrini estimates  NVIDIA’s Rubin platform could consume more LPDDR in 2027 than Apple and Samsung combined. In our opinion, that is the right way to think about the shock. This is not just another server memory cycle. A product category sized around mobile devices is being pulled into AI infrastructure.
The timing is brutal. DRAM is already in its tightest market in years. Prices have surged since the start of 2026, with some market reports pointing to roughly 90% to 95% DRAM price increases in Q1 alone and further increases expected in Q2.
The old hierarchy, where HBM was expensive and conventional DRAM was abundant, is breaking down. As HBM, DDR5, and LPDDR5X all tighten at once, the memory shortage  becomes a system-wide AI infrastructure problem.
The beneficiaries are obvious at the top level: Samsung, SK Hynix, and Micron control more than 90% of global DRAM. But the read-through is not identical for all three.
Micron ($MU) has one of the clearest Vera-specific stories. Its SOCAMM2 modules are designed for NVIDIA Vera Rubin systems and standalone Vera CPUs.
SK Hynix and Samsung also sit inside the broader SOCAMM ecosystem. Samsung has the most to gain if the entire DRAM pricing umbrella lifts and its AI memory execution improves.
This is why the CPU resurgence extends our memory thesis, which we laid out in “The memory trade is not done”. After that piece, the most common question we got was: when do you exit?
Teng Yan
@tengyanAI
·
May 4
The Memory Trade Is Not Done Yet
HBM (high bandwidth memory) is tight. 
Your analyst knows it, your PM knows it, and the guy posting supply-chain tweets at 2 a.m. definitely knows it too.
While it was interesting in 2025, that’s no...
Our answer: not yet.
We think memory remains a layup trade for the next few quarters.
More CPUs = more memory needed.
We believe this streteches the memory upcycle far longer than typical memory boom-busts of the past - probably 2028 and beyond. ASML’s EUV machines puts a natural bottleneck on how fast fab capacity can expand.
The memory players are deliberately cautious on expansion. Supply discipline is what protects the pricing. New memory fabs won't reach volume before 2027, and both Samsung and SK Hynix have warned shortages run through 2027 at least, with the cycle possibly stretching past 2028.
📷
Micron (MU), one of the leading DDR5 manufacturers in the world, hit new ATH this month
2. Wafers: the allocation trade-off
TSMC is already maxed out. Its leading-edge 3nm capacity is running flat out, with AI demand roughly three times what it can produce.
A CPU order doesn't jump that queue. It lines up behind NVIDIA's and AMD's GPUs, behind every hyperscaler's custom accelerator, behind Apple.
And the margin math isn’t really favourable for CPUs. A GPU is worth far more per wafer than a CPU, so when a fabless designer splits a fixed allocation, the GPU usually wins.
AMD has been managing the squeeze by re-ramping older EPYC generations on the mature N5 node to free N3 for its newest parts which works but it is more of a one-time release valve than a fix.
Nvidia might have a similar problem too, especially with them pushing into this new growth sector. With Vera carrying a $200 billion TAM, NVIDIA now has to split TSMC capacity between Rubin GPUs and Vera CPUs, the same trade-off AMD faces, at the company that least wants to make it.
Jensen Huang said on the call NVIDIA expects to be “supply-constrained for the entire life of Vera Rubin”. And every Vera Rubin system pairs its Rubin GPUs to Vera CPUs two-to-one. If Vera is short, the GPUs it orchestrates can't ship as complete racks.
That leaves Intel in an unusual position. It is the only major data center CPU maker that still designs and manufactures its own chips. Its process technology isn't best-in-class, and it's bleeding market share.
But if TSMC becomes the bottleneck for everyone else (which it already is), Intel's internal capacity becomes more valuable by default, even if imperfect. It's the only CPU supplier that doesn't have to ask TSMC for permission to ship.
Beneficiaries of this constraint: the chokepoint itself.
TSMC ($TSM) builds for all of them, and has been raising advanced-node prices for four straight years into that demand.
New capacity is coming, but slowly: 3nm output up more than 40% by the end of 2026, new fabs in Tainan, Arizona and Japan landing across 2027 and 2028, and 2nm already booked into 2028. TSMC's own read is that supply and demand only start to balance around the first half of 2027.
3. Packaging: the next release valve
High-core-count CPUs are becoming packaging-intensive products at exactly the moment advanced packaging is already full.
The CPU bottleneck is not just about wafers.
High-core-count CPUs are chiplet designs, many small dies stitched into one package. As core counts rise, the package starts to matter almost as much as the die.
It isn't the same CoWoS line the GPUs fill, but it's adjacent, and it's tight.
The clearest signal is Amkor ($AMKR).
Amkor (AMKR) price chart on Tessara
On its most recent quarter, the company called out a dedicated data center CPU program ramping on its HDFO (high-density fan-out) platform, with volume production starting in the second quarter of 2026.
HDFO is important because it can house dense interconnects in the package and reduce the laminate substrate, easing one of the very shortages that constrains CPUs today. Amkor is expanding HDFO capacity in Korea and pushing lower-value consumer work to Vietnam to free up cleanroom for it.
Its 2026 capex plan is roughly $2.5B to $3B, unusually large for an OSAT.
The signal got louder this week as AMD committed more than $10 billion across Taiwan's chip ecosystem, including a partnership with ASE to scale the 2.5D packaging behind its next-generation EPYC CPUs. A CPU vendor paying directly to lock down packaging capacity before it runs short
Packaging may be the fastest relief valve in the CPU stack because it ramps before wafer and memory supply fully ease. But it is only partial relief. Packaging houses are constrained by substrates, bumping tools, inspection capacity, skilled labor, and yield learning curves.
Amkor is the cleanest named HDFO beneficiary, with a dedicated data center CPU program and $2.5B to $3B of capex behind it. ASE ($ASX) is the more direct Taiwan-side read on AMD’s next-generation EPYC packaging ramp. Onto Innovation and other inspection/metrology names sit one layer upstream.
Conclusion
The GPU is still the center of the AI data center.
It remains the biggest power draw, the biggest capex line, and the hardest component to source at scale. But agentic AI changes what has to sit around the GPU.
Agents call tools. They search files. They write code. They run tests. They coordinate sub-agents. They hold state across long tasks.
That turns the CPU from a host processor into a scaling layer.
Once that happens, the supply chain gets harder.
More agents mean more CPUs.
More CPUs mean more DRAM.
More CPUs mean more leading-edge wafers.
More CPUs mean more packaging, substrates, I/O, and power delivery.
The next bottleneck is unlikely to be one clean component. It will be the collision of every layer of the rack trying to scale at once.
That is why the cleanest trade is not simply “buy CPU vendors.”
The cleaner trade is to own the scarce inputs.
TSMC for leading-edge manufacturing.
Micron, Samsung, and SK Hynix for memory.
Amkor and ASE for packaging capacity tied to high-end CPU growth.
The CPU was supposed to be the boring part of the AI server.
Agentic AI made it a bottleneck
---
Thanks to @0xHiken for researching and co-writing this with me.
This research was powered by tessara.tech, our live constraint graph for the AI infrastructure buildout. (limited slots open for early access, see website)
Tessara tracks what is becoming scarce across compute, memory, foundry, networking, packaging, and power, then maps those constraints to the public companies exposed.
In this piece, Tessara flagged the server CPU inflection, traced the bottlenecks that could limit supply, and identified the second-order beneficiaries across memory, foundry, and packaging.
300+ companies tracked across the AI infrastructure stack.
This article is for informational and research purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any security. Tessara Research does not publish price targets. The views expressed here reflect our analysis at the time of publication and may change as new evidence arrives. Readers should do their own research and consult a qualified financial adviser before making investment decisions.