# Reality Fork

Agent-powered decision simulation. Give it a life decision, and it generates
parallel "what-if" timelines so you can see how each path might unfold.

- **Adaptive scope**: a conversation decision gets simulated in days; a career
  decision gets simulated in months or years. The planner agent picks the
  horizon.
- **Parallel multi-agent simulation**: up to four specialized agents
  (financial, career, psychological, events) score each fork step-by-step,
  then a narrator agent stitches them into a cohesive story.
- **Side-by-side comparison**: every fork gets its own timeline, plus line
  charts comparing forks on each dimension.

Built for the UMBC Hackathon 2026.

## Tech

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4 + custom UI primitives
- Recharts for metric charts
- Zod 4 for schema contracts
- **LLM: pluggable** (with a shared rate-limited wrapper that throttles
  requests-per-minute and backs off on 429s using the server's retry hint)
  - **MiniMax** (default) — M2.7-highspeed via the Anthropic-compatible
    endpoint. Structured output is enforced via forced tool use.
  - **Google Gemini** — grammar-enforced `responseSchema`.
  - **Ollama Cloud** — free, format hint only (less reliable for strict JSON).

## Run locally

```bash
pnpm install
cp .env.example .env.local
# edit .env.local and paste MINIMAX_API_KEY (or switch LLM_PROVIDER)
pnpm dev
```

Open http://localhost:3000.

> A real simulation fires ~11 LLM calls (planner + forks × dimensions +
> narrators) and takes roughly **2–5 minutes** end to end. The loading screen
> is not frozen.

## Switching provider / model

Set env vars in `.env.local`:

```bash
# default — MiniMax M2.7-highspeed (Anthropic-compatible)
LLM_PROVIDER=minimax
MINIMAX_API_KEY=sk-...
# LLM_MODEL=MiniMax-M2.7-highspeed
# MINIMAX_BASE_URL=https://api.minimax.io/anthropic

# or: Gemini (free tier)
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
# LLM_MODEL=gemini-2.5-flash-lite

# or: Ollama Cloud (free)
LLM_PROVIDER=ollama
OLLAMA_API_KEY=...
# LLM_MODEL=qwen3.5:397b

# optional: override the per-minute request cap (defaults: minimax=60,
# gemini=5, ollama=60)
# LLM_RPM=30
```

The provider interface is in [`lib/llm/types.ts`](lib/llm/types.ts). Add a new
provider by implementing `LlmProvider.generateStructured` and wiring it in
[`lib/llm/index.ts`](lib/llm/index.ts). Every provider is automatically wrapped
in [`RateLimitedProvider`](lib/llm/rate-limiter.ts).

## Architecture

```
User decision + context
  ↓
[Planner agent] → horizon, granularity, dimensions, forks
  ↓
for each fork (parallel):
  ├─ [Financial agent]      ┐
  ├─ [Career agent]         │ parallel structured-output calls
  ├─ [Psychological agent]  │ (dimensions list is adaptive)
  └─ [Events agent]         ┘
  ↓
[Narrator agent] → cohesive step-by-step timeline
  ↓
Side-by-side UI + metric charts
```

All agent I/O is typed via shared Zod schemas in [`lib/schemas.ts`](lib/schemas.ts).
Orchestration lives in [`lib/orchestrator.ts`](lib/orchestrator.ts) and uses
nested `Promise.all` — the planner decides *which* dimensions matter for a
given decision, so some runs only spin up 2–3 dimensional agents per fork.

## Deploy

```bash
vercel
# add MINIMAX_API_KEY (and LLM_PROVIDER if not default) in the Vercel dashboard
```

The `/api/simulate` route sets `maxDuration = 60`. A full simulation can
exceed that — use Vercel Pro for a longer function timeout, or move to a
streaming response that emits forks incrementally.
