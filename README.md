# 🌱 Branch

> 🤖 **Autonomous feature-development agent.** File a GitHub issue → ~60 seconds later a real PR opens against a forked-from-production database, schema-verified through a federated GraphQL supergraph, packaged in a Chainguard-hardened Wolfi image with a measured CVE delta. ⚡

## 💡 Why this exists

Shipping a small feature today still costs hours of engineering wall-time: write the migration, hope it doesn't lock prod, scaffold a staging DB, write a feature branch, push, wait for CI, debug a flaky preview env, scan the container, get reviewed, deploy. Every step is automatable but no single tool owns the whole loop.

🌱 **Branch owns the loop.** It reads the issue, writes the migration, **applies it to a real copy-on-write fork of production**, federation-verifies the result through the same GraphQL graph that serves humans, opens a PR with a `psql`-able preview database attached, and ships a hardened OCI image with a real CVE delta vs upstream — all from one webhook, all in under a minute, all visible on a live SSE-driven dashboard. 🚀

🎯 **Who benefits**
- 🧑‍💻 **Engineers** — stop hand-writing the same migration → preview-env → PR scaffolding for the 100th time
- 🛡️ **Platform / SRE** — every preview env is automatically Wolfi-hardened, signed, and CVE-scanned; supply-chain hygiene is the default, not a slide deck
- 📊 **Eng leadership** — turn "feature lead time" into a dial you can move; every step is observable on the dashboard with timings
- 🤖 **Future-of-coding** — Branch's planner is itself a deployable Guild agent, the same supergraph that powers the UI is exposed as MCP tools, so any LLM client (Claude Desktop, Cursor, etc.) can drive Branch end-to-end

## 🎬 What the demo shows — every step is real, no canned data

1. 📨 **Issue lands** — *"Add VAT support for EU customers"*
2. 🧠 **Plan** — GLM 5.1 emits a strict-JSON plan over an OpenAI-compatible endpoint, executed inside a Guild coded-agent subprocess
3. 🍴 **Fork** — Ghost copy-on-write clone of `branch-prod`; the card shows the real `postgresql://tsdbadmin:…@*.tsdb.cloud.timescale.com:36019/tsdb` URL
4. 🛠️ **Migrate** — each DDL statement applied to the fork over TLS (real `OK (185ms): ALTER TABLE customers ADD COLUMN …` log lines, idempotent on rerun)
5. ✅ **Verify** — fork inspected directly via `information_schema` (proves the column, CHECK constraint, and partial index all landed) **and** a federated query (`customers { orders { … } } + searchProducts(…)`) round-trips through Cosmo Router → 3 Pothos subgraphs → Postgres
6. 🔀 **PR** — GitHub App commits via the git-data API and opens a real PR on a demo repo, with the fork DSN embedded in the description
7. 📦 **Image** — `cgr.dev/chainguard/apko` builds the preview runtime; `cgr.dev/chainguard/grype` scans both `registry:node:20` and the apko `oci-archive:` and prints the CVE delta (latest run: **`node:20=1408  chainguard=0  Δ=-1408`**)

## Sponsor leverage

| Sponsor | What Branch uses | Why it's impressive |
|---|---|---|
| **Wundergraph (Cosmo)** | Cosmo Router (`v0.311.0`) federating three Pothos subgraphs (`customers` / `orders` / `catalog`) over Drizzle + Postgres. **Cosmo MCP Gateway** at `:5025/mcp` auto-exposes every operation as an LLM tool. **Cosmo Streams** registers NATS as the event provider. Supergraph composed with `wgc` from live SDL. | Cosmo is Branch's *agent-tools layer*. The exact same federated graph that powers humans at `http://localhost:3002/` powers the LLM planner via MCP. One supergraph, two consumers — no bespoke "agent tools" service to maintain. |
| **Ghost (Tiger Data)** | Live `ghost.build/v0` adapter: `POST /spaces/{id}/databases/{ref}/fork`, status polling until `running`, password retrieval, real `postgresql://…` connection string per PR. Idempotent reuse if a fork already exists. The orchestrator then opens a postgres-js connection to the fork and applies the migration's DDL statement-by-statement (`packages/db/src/fork.ts`), bootstrapping the customers table on a cold fork; the Verify phase queries `information_schema` on the same fork to prove the new column, CHECK constraint, and partial index all landed. | "Fork a database as casually as you fork a branch" is Ghost's thesis — Branch makes it the **default of every PR**, not a manual setup step. The Fork card on the dashboard ships a `psql`-able URL pointing at a real Timescale Cloud database that holds a copy-on-write snapshot of prod, with the PR's migration **actually applied** to it (real timings: 185ms / 139ms / 127ms for the 3 statements in the VAT demo). |
| **Chainguard** | `cgr.dev/chainguard/apko` builds the per-PR preview image from `services/preview-builder/apko.yaml` (Wolfi base + `nodejs-22`); `cgr.dev/chainguard/grype` runs the CVE scan against `registry:node:20` and the apko-built `oci-archive:` tarball — no docker-socket plumbing required, both targets are scanned without leaving the grype container; `cgr.dev/chainguard/postgres` is Branch's production database container. Apko config declares non-root accounts and dual `x86_64` + `aarch64` archs. | Supply-chain security isn't a bolt-on — every artifact Branch produces is Chainguard-hardened by default. The Image card shows a real `sha256:…` digest, real image size (53 MB), and a real CVE delta vs upstream: **`node:20=1408  chainguard=0  Δ=-1408`** — produced live by grype during the demo, not slide-ware. |
| **Guild.ai** | Coded agents in `services/agents/{planner,executor}/` — `"use agent"` directive, `agent({ description, inputSchema, outputSchema, run })` factory, Zod schemas, `progressLogNotifyEvent` notifications. The orchestrator's plan phase **spawns the planner as a real subprocess** (`node --import tsx/esm src/agent.ts`) and parses the JSON plan from stdout — the same code path that runs after `guild agent deploy`. SDK loaded via dynamic import so the demo works before `guild auth login`. | Guild's coded-agent primitives map 1:1 onto Branch's planner/executor split, and the planner is a *deployable* artifact today, not a function buried in the app. The dashboard log line "Guild planner agent returned plan (subprocess, …)" is visible proof that planning crossed a process boundary. |
| **InsForge** | `@insforge/sdk` wired in `packages/adapters/insforge/`: **realtime** publishes every orchestrator event to channel `branch:run:<runId>`, **storage** uploads each migration's SQL to bucket `branch-artifacts`, **AI + pgvector** powers `searchPrHistory`/`indexPrHistory` for the plan and PR phases. Cosine similarity runs server-side via the `branch_match_pr_history` Postgres RPC; embeddings come from the InsForge AI gateway. One-shot bootstrap in `packages/adapters/insforge/sql/bootstrap.sql`. | Three InsForge surfaces, three different orchestrator phases — Realtime carries the trace bus, Storage holds the migration artifacts, AI + pgvector powers "have we shipped something like this before?" lookups that materially improve planner quality. The infrastructure surface area we'd otherwise own (Redis + S3 + an embeddings API + a vector DB) collapses to one SDK. |

## Run it

Requires Docker Desktop and Node ≥ 22.

```bash
pnpm install
pnpm demo:live          # boots Postgres + NATS + Cosmo Router + 3 subgraphs + web
                        # → http://localhost:3000  →  click "Run demo"
pnpm demo:down          # stop everything
```

For zero-credentials narration mode (every sponsor falls back to a rich mock):

```bash
pnpm demo
```

Live-mode credentials are documented in [`deploy.md`](./deploy.md). [`sponsors.md`](./sponsors.md) has the per-sponsor pitch in long form.

## Architecture

- `apps/web/` — Next.js 16 dashboard + SSE orchestrator (`src/lib/orchestrator/run.ts`)
- `packages/adapters/{ghost,github,chainguard,wundergraph,insforge}/` — live + mock adapters, auto-fallback when creds are missing
- `packages/shared/` — zod schemas, env parser, run-event types, demo fixtures
- `packages/db/` — Drizzle schema, migrations, idempotent seed
- `services/subgraphs/{customers,orders,catalog}/` — Pothos federation subgraphs over Drizzle
- `services/cosmo-router/` — Cosmo supergraph router config, persisted operations, NATS event provider
- `services/preview-builder/apko.yaml` — Chainguard Wolfi image spec for per-PR previews
- `services/agents/{planner,executor}/` — Guild coded-agent projects

## MCP for any client

Point Claude Desktop / Cursor / any MCP client at the running router:

```json
{ "mcpServers": { "branch": { "transport": "http", "url": "http://localhost:5025/mcp" } } }
```

Tools exposed: `execute_graphql`, `execute_operation_{get_customer_by_id, list_customers, search_products}`, `get_operation_info`, `get_schema`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm demo` | dashboard only, every sponsor mocked (no creds, no Docker) |
| `pnpm demo:live` | full live stack: Postgres + NATS + Cosmo Router + subgraphs + web |
| `pnpm demo:down` | stop the live stack |
| `pnpm compose:supergraph` | re-compose `services/cosmo-router/supergraph.json` from subgraph SDL |
| `pnpm typecheck` | turbo typecheck across the workspace |
| `pnpm build` | turbo build (including `next build`) |
