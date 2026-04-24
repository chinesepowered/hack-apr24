# Branch

Autonomous feature-dev agent: file a GitHub issue, get a working PR with a live forked-DB preview environment in minutes.

See [`plan.md`](./plan.md) for the full architecture, sponsor prize targets, and build phases.

## Demo (zero credentials)

```bash
pnpm install
pnpm demo
```

Open http://localhost:3000 and click **Run demo**. Every sponsor integration
falls back to a rich mock that streams over SSE, so no API keys are required
to see the full pipeline end to end.

Stage flow (~90s):
1. Dashboard loads with a seeded GitHub issue ("Add VAT support for EU customers").
2. Click **Run demo**. The phase timeline advances through plan → fork → migrate → verify → pr → image.
3. Ghost fork card shows a copyable `psql` URL; Migration card shows the generated SQL with syntax coloring.
4. Verify card shows the before/after of the federated GraphQL query.
5. PR card shows the opened PR with diff stats and the full PR body.
6. Image card shows the Chainguard CVE delta (47 → 0).

## Live mode (optional)

Fill in `.env` (see `.env.example`) and restart. The planner will call GLM 5.1
at `OPENAI_BASE_URL` when `OPENAI_API_KEY` and `OPENAI_MODEL` are set.
Per-sponsor mocks can be toggled with `USE_MOCK_GHOST=1` etc.

## Live stack (real Postgres + real Cosmo federation)

Boots Chainguard Postgres, NATS, Cosmo Router, and the three Pothos
subgraphs wired to Drizzle queries against seeded Postgres. The dashboard's
**verify** phase hits the real supergraph instead of returning canned data.

```bash
# one-time: compose the supergraph.json from live SDL
pnpm compose:supergraph

# boot everything (Postgres, NATS, router :3002, subgraphs, web :3000)
pnpm demo:live

# tear down subgraphs + containers
pnpm demo:down
```

Requires Docker Desktop running. The router serves the GraphQL playground at
http://localhost:3002/ and accepts federated queries across
`customers`/`orders`/`catalog` subgraphs. `pnpm compose:supergraph` must be
re-run whenever a subgraph's SDL changes.

## Repo layout

- `apps/web/` — Next.js 16 dashboard + SSE orchestrator (`src/lib/orchestrator/`)
- `packages/shared/` — zod schemas, env parser, demo fixtures
- `packages/adapters/{ghost,github,chainguard,insforge,wundergraph}/` — live + mock sponsor adapters
- `services/agents/{planner,executor}/` — Guild coded-agent projects (standalone npm)
- `services/subgraphs/{customers,orders,catalog}/` — Pothos federation subgraphs
- `services/cosmo-router/` — Cosmo supergraph router config
- `services/preview-builder/` — apko YAML for per-PR Chainguard images

## Scripts

```
pnpm demo              # dashboard only (mocks-first, no creds needed)
pnpm demo:live         # full stack: Postgres + NATS + Cosmo router + subgraphs + web
pnpm demo:down         # stop the live stack
pnpm compose:supergraph  # re-compose services/cosmo-router/supergraph.json
pnpm typecheck         # turbo typecheck across workspace
pnpm build             # turbo build (including next build for the dashboard)
```
