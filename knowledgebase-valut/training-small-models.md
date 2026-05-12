# Training Small models

### section 1

https://x.com/cjzafir/status/2053975471218659695 

If you're fine tuning open source models, don't buy a GPU in the beginning. 

Just tune models on cloud GPUs.

Starting from $1/hr to $3/hr and will cost you around $50 to $90 to get your small LLM model tuned.

Why cloud GPUs?
- no upfront cost
- instant scaling
- latest GPUs
- cheaper for experimentation

Providers that are good:
- Lambda
- Runpod
- Vast AI
- Google Colab (if model < 9B)

Don't buy a GPU until you're fine tuning models every single day for last 90 days.

What are the best cloud GPUs?

RTX 4090 > Cheap LoRA/QLoRA
A100 80GB > Best value overall
H100 > Faster large-model training
H200 > Long-context fine-tuning
B200 > Frontier-scale workloads

(I just use A100 80GB for most SLM fine tuning jobs. It's cheaper and gets the work done.)

I found no information on X about this when I started, so thought I should share it with you if you're getting in on it. Enjoy

### Section 2

https://x.com/cjzafir/status/2053847506124206095

If you love fine-tuning open-source models (like me), then listen.

> Start with 1B, 2B, 4B, and 8B models. (Don't start with a 27B model or bigger at first.)

> Use WebGPU providers. I use Google Colab Pro for any model smaller than 9B. A single A100 80GB costs around $0.60/hr, which is cheap. Enough for small models.

> Don’t buy GPUs unless you fine-tune 7 to 10 models. You'll understand the nitty-gritty in the process.

> Use Codex 5.5 × DeepSeek v4 Pro to create datasets. Codex to plan, DeepSeek v4 Pro to generate rows.

> Use Unsloth's instruct models as a base from Hugging Face. Yes, there are others too, but Unsloth also provides fast fine-tuning notebooks.

> Use Unsloth's fine-tuning notebooks as a reference. Paste them into Codex, and Codex will write a custom notebook with the configs you need.

> Spend 1 day learning about:
- SFT (supervised fine-tuning)
- RL training (GRPO, DPO, PPO, etc.)
- LoRA / QLoRA training
- Quantization and types
- Local inference engines (llama.cpp)
- KV cache and prompt cache

> Just get started. Claude, Codex, and ChatGPT can design a step-by-step plan for how you can fine-tune your first AI model.

Future tech is moving toward small 5B to 15B ELMs (Expert Language Models) rather than general 1T LLMs.

So fine-tuning is an important skill that anyone can acquire today.

Tune models, test them, use them. Then fine-tune for companies and make a career out of it. (Companies pay $50k+ to fine-tune models on their data so they can get personalized AI models.)

Shoot your questions below. I'll be sharing in-depth raw findings about this topic in the coming days.

