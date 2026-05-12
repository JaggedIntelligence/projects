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
