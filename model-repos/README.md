# Model Repos

### TOC

1. Comp : AI Native platform to get companies compliant - Vanta & Drata Alternative
  SR Note: $34 MM Series A, yet OSS , **Production grade OSS repo** 

2. CRM : CRM designed for AI agents. Agentic-first CRM
   SR Note: CRM is from above "Comp AI" company , so it is world class OSS

3. 


-- =========================================== ----------------------------------
# 1. Comp : AI Native platform to get companies compliant - Vanta & Drata Alternative
https://github.com/trycompai/comp
https://www.trycomp.ai/

SR Note: $34 MM Series A, yet OSS , **Production grade OSS repo** 
https://techcrunch.com/2026/09/17/comp-ai-sets-eyes-on-a-continiously-agentic-future-for-security-and-complaince/

one Prisma DB table schema PER file ( modular)
https://github.com/trycompai/comp/tree/main/packages/db/prisma/schema

## Compared to Vanta Darta 
 - **SR Note: it seems these "Comp AI" company ( 3 founders) are eating Vanta & Darta Lunch** by offering Price in 20 minutes (when you fill Form of What complaince you need), price may be $5k compared to $30K of Vanta & Drata ...

 - **SR TODO: can we reserach an "enterprise domain"** and build some thing for Enterprise by taking this 'Comp AI" code base for some enterprise expensive software .. like un-seating "vanta and Drata"

### Drata vs Vanta vs. Comp AI : which should you choose?

https://www.vanta.com/company/about
- Vanta raised a $150 million Series D funding round in July 2025, bringing its total external funding to $504 million and raising its valuation to $4.15 billion
- YC startup .. shows professionalism , see Drata/about page .. bunch of Jokers Photos when flipped ..
- $300 MM ARR in 2026 JUL?

https://drata.com/about
Series C (December 2022): Raised $200 million, .. Salesforce Ventures, and others, doubling its valuation to $2 billion
- $100 MM ARR in 2025 

- Both Drata and Vanta are enterprise compliance platforms with similar pricing ($20-80K/year). Here's how they compare - and why Comp AI might be a better fit.
https://www.trycomp.ai/drata-vs-vanta

### Compliance that actually improves your security
- Most platforms give you a checklist. We give you a security posture you can prove - continuously, automatically, and in the open.
https://github.com/trycompai/comp/tree/main/packages/integration-platform 


### A device agent that never sleeps
A checklist doesn't stop a misconfigured laptop at 2am. Our open-source device agent runs 24/7 on every employee machine - checking disk encryption, firewall status, screen lock, password length, and antivirus. Failures are flagged instantly, not discovered during the next audit cycle.
https://github.com/trycompai/comp/tree/main/packages/device-agent 

### Integrations : Extensible platform for building compliance check integrations

SR note:  NestJS is the backend platform ...

https://www.trycomp.ai/docs/integrations

```
Integrations
├── Manifests (define integrations)
│   ├── Auth config (OAuth, API key, custom)
│   ├── Checks (compliance validations)
│   └── Variables (user configuration)
├── Runtime (execute checks)
│   ├── Check context (API, logging, reporting)
│   └── Check runner (orchestration)
├── API (NestJS backend)
│   ├── Connections (manage user connections)
│   ├── OAuth (handle OAuth flow)
│   ├── Checks (run checks)
│   └── Variables (manage user settings)
└── Trigger Tasks (background execution)
    ├── run-connection-checks (auto-run after connect)
    ├── run-task-integration-checks (daily scheduled)
    └── sync-employees-schedule (daily employee sync)

```


### Built-in Integrations
​
```
Cloud Providers
AWS - Security Hub findings
Azure - Microsoft Defender for Cloud
GCP - Security Command Center
​
Identity & Access
Google Workspace - User compliance, 2FA checks
Rippling - Employee sync
​
Developer Tools
GitHub - Code security, branch protection, Dependabot
Vercel - Deployment monitoring
Linear - Team privacy, SSO checks
```

-- =========================================== ----------------------------------


# 2. CRM : CRM designed for AI agents. Agentic-first CRM
   SR Note: CRM is from above "Comp AI" company , so it is world class OSS

### What is this CRM: 
Most CRMs are a database with a form in front of it. The AI ones bolt a chat box onto the side of that form. Both leave the actual work — finding out what is true, and writing it down — to a human who has better things to do.

- **This is built the other way round. The agent is not a feature of the CRM; the CRM is where the agent keeps its notes.** It runs on its own deployment, on its own schedule, against its own work queue. It decides what to look at next, books its own follow-ups, spends a research budget, and stops when the budget runs out. Nothing about it is request-response: close the browser and it keeps goin

### repo Tech 
Prisma DB Schema
https://github.com/trycompai/crm/blob/release/packages/db/prisma/schema.prisma 


```
The stack
A Turborepo monorepo on Bun, deployed on Vercel.

Agent	eve — durable sessions, tools, skills, schedules, sandboxes
Model	Vercel AI Gateway — no provider SDK, and OIDC on Vercel means no key to manage

Sandbox	Vercel Sandbox in production, Docker or microsandbox locally

Front end	Next.js App Router · shadcn/ui · nuqs for URL state

API	NestJS   with nestjs-trpc — HTTP, auth, tRPC, mailbox sync

Data	Prisma · Postgres (Neon) · optional Redis (Upstash)
Auth	Better Auth — Google, Microsoft, or your own IdP; one allow-list

Files	Vercel Blob — mirrors profile pictures so they survive the source going away
Tooling	Biome · TypeScript everywhere
```