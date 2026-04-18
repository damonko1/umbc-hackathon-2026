# Reality Fork

Agent-powered decision simulation. Give it a life decision, and it generates
parallel "what-if" timelines so you can see how each path might unfold.

- **Adaptive scope**: a conversation decision gets simulated in days; a career
  decision gets simulated in months or years. The planner agent picks the
  horizon.
- **Parallel "multi-agent" simulation**: four specialized agents (financial,
  career, psychological, events) score each fork month-by-month; a narrator
  agent stitches them into a cohesive story.
- **Side-by-side comparison**: every fork gets its own timeline, plus line
  charts comparing forks on each dimension.

Built for the UMBC Hackathon 2026.

## Tech

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4 + custom UI primitives
- Recharts for metric charts
- Zod for schema contracts
- **LLM: pluggable**
  - Ollama Cloud (default, free) — [get a key](https://ollama.com/settings/keys)
  - Google Gemini (alternate)

## Run locally

```bash
pnpm install
cp .env.example .env.local
# edit .env.local and paste your OLLAMA_API_KEY
pnpm dev
```

Open http://localhost:3000.

## Switching provider / model

Set env vars in `.env.local`:

```bash
# default — free via Ollama Cloud
LLM_PROVIDER=ollama
OLLAMA_API_KEY=...
# LLM_MODEL=qwen3.5:397b

# or: Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
# LLM_MODEL=gemini-2.0-flash
```

The provider interface is in `lib/llm/types.ts`. Add a new provider by
implementing `LlmProvider.generateStructured` and wiring it in
`lib/llm/index.ts`.

## Architecture

```
User decision + context
  ↓
[Planner agent] → horizon, granularity, dimensions, forks
  ↓
for each fork (parallel):
  ├─ [Financial agent]      ┐
  ├─ [Career agent]         │ parallel structured-output calls
  ├─ [Psychological agent]  │
  └─ [Events agent]         ┘
  ↓
[Narrator agent] → cohesive month/step-by-step timeline
  ↓
Side-by-side UI + metric charts
```

All agent I/O is typed via shared Zod schemas in `lib/schemas.ts`.

## Deploy

```bash
vercel
# add OLLAMA_API_KEY (and LLM_PROVIDER if not default) in the Vercel dashboard
```

The `/api/simulate` route has `maxDuration = 60` to handle longer agent chains.
