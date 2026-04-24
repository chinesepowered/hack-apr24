# Guild coded agents

These are **standalone npm projects** managed by the Guild CLI, intentionally
excluded from the root pnpm workspace. See `pnpm-workspace.yaml` for the
exclusion rationale.

- `planner/` — ingests a GitHub issue, emits a structured JSON Plan
- `executor/` — drives a Plan through fork → migrate → verify → PR → image

Both use the `openai` SDK pointed at `OPENAI_BASE_URL` (GLM 5.1 or any
OpenAI-compatible endpoint). Guild's workspace-level `task.llm` is not used
because it does not support per-agent model selection.

## Local run (no Guild cloud)

```
cd services/agents/planner && npm install && npm start
cd services/agents/executor && npm install && npm start
```

Both accept `USE_MOCK_LLM=1` to skip the LLM call and return a canned response
— the same path the demo dashboard uses by default.

## Deploying as Guild coded agents

```
cd services/agents/planner
guild auth login
guild agent init --template coded-agent
guild agent deploy
```

The actual logic in `src/agent.ts` is unchanged between local and Guild modes —
the `"use agent"` directive switches execution context at runtime.
