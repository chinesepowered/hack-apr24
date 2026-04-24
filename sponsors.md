# Branch — Sponsor Leverage & Pitches

Branch is an autonomous feature-development agent: a GitHub issue lands, and minutes later a real PR opens against a live preview environment — schema changes forked off production data, code compiled into a hardened container, end-to-end verified against a federated GraphQL supergraph. This document covers the sponsors Branch is built on, what we use from each, and the angle we'd pitch to the judges for that specific prize.

---

## WunderGraph (Cosmo)

**What we use**
- **Cosmo Router** (`v0.311.0`) running in Docker at `:3002/graphql`, serving a federated supergraph composed from three independently-deployed subgraphs: `customers`, `orders`, `catalog`. Each subgraph is Pothos + `@graphql-tools/federation` on its own Postgres slice via Drizzle.
- **Cosmo MCP Gateway** at `:5025/mcp`. Every federated operation is auto-exposed as an MCP tool so an LLM agent can `CustomersByCountry("DE")` instead of hand-writing a GraphQL query.
- **Cosmo Streams (NATS)**. NATS is registered as an event provider in `services/cosmo-router/config.yaml` so subgraphs can publish/subscribe through the supergraph.
- **Schema contracts via `wgc`** for composing the supergraph before `demo:live` runs.

**Where it appears in the demo**
- The dashboard's **Verify** phase runs a real federated query (`customers { orders { … } } + searchProducts(…)`) against the live router — so the UI is provably showing data that crossed three subgraphs, not a canned payload.
- Because the agent speaks MCP, the same supergraph is the single planning surface for humans and for LLMs. No custom "agent tools" layer; Cosmo is the tools layer.

**Pitch (Wundergraph — 1st/2nd)**
*"Cosmo isn't just our GraphQL layer — it's the agent's interface to our system. Three federated subgraphs plus the MCP Gateway plus NATS streams plus schema contracts, all composed by `wgc` into one binary that's running right there in Docker. When Branch's planner needs to reason about 'what does our customer schema look like?' it calls Cosmo MCP tools, not a bespoke introspection endpoint. The judge demo literally shows a federated query roundtripping through the router into three Postgres databases on stage."*

---

## Ghost (Tiger Data)

**What we use**
- **`ghost.build/v0` HTTP API** via the `GhostLive` adapter: space discovery (`GET /spaces`), fork creation (`POST /spaces/{id}/databases/{ref}/fork`), status polling until `running`, then build a real `postgres://…` connection string with SSL.
- **Ghost CLI** for setup (`ghost login`, `ghost api-key create`, `ghost create --name branch-prod --wait`).
- A persistent `branch-prod` database on Ghost that Branch forks on every run. Each fork is copy-on-write, lands in seconds, and shows up in the dashboard's **Fork** card with the real Timescale-Cloud host, port, and storage usage from the API response.

**Where it appears in the demo**
- When a run starts, the UI's Fork card flips from "forking…" to a concrete `postgres://tsdbadmin:…@penuzobpcy.vq9ejzriud.tsdb.cloud.timescale.com:33599/pr-101-vat-support` connection string — a **real** psql-able database that holds a copy-on-write snapshot of prod, against which the PR's migration has just been applied.

**Pitch (Ghost — top 5)**
*"Ghost's entire thesis is 'fork databases as casually as you fork branches.' Branch makes that literal: every PR gets a forked database as part of opening the PR. No staging environment, no 'does this migration blow up with real data?' anxiety — the PR card has a psql URL attached. That's the feature Ghost is building toward; we shipped it in a weekend."*

---

## Chainguard

**What we use**
- **`cgr.dev/chainguard/apko`** shelled out via `docker run` to build the preview image declared in `services/preview-builder/apko.yaml` — a Wolfi-based OCI bundle that runs the Branch preview server. No local apko install required.
- **`cgr.dev/chainguard/grype`** in the same pattern to scan the built image and report CVEs vs. a vanilla `node:20` baseline — that delta is what the dashboard's **Image** card renders.
- **Chainguard pull token** in `.env` (`CHAINGUARD_PULL_TOKEN_USERNAME`/`_PASSWORD`) for authenticated pulls when we move beyond the public catalog.
- **Chainguard Postgres** (`cgr.dev/chainguard/postgres`) as the base database container in `docker-compose.yml` — the same minimal-attack-surface image Chainguard ships, now serving Branch's prod DB.

**Where it appears in the demo**
- The **Build** phase produces a real `sha256:…` digest loaded into the host Docker daemon, and the **Image** card shows CVE counts ("node:20: 312 CVEs → preview: 0 CVEs, 48MB"). That number is live from `grype`, not a slide.

**Pitch (Chainguard — 1st)**
*"Every PR Branch opens ships with a Chainguard-hardened preview image built by apko with a real CVE delta vs. upstream. Our base containers are already Chainguard. Supply-chain security isn't a bolt-on step; it's the default runtime for every artifact the agent produces."*

---

## Guild.ai

**What we planned**
The original architecture routes the planner + executor through `@guildai/agents-sdk` coded agents (`"use agent"` directive, `AUTO_MANAGED_STATE` template), with Guild acting as the orchestration and trigger layer (GitHub webhook → Guild trigger → planner → executor).

**Current integration state (honest)**
We kept the trigger design but swapped the *LLM invocation* to a direct OpenAI-compatible call from inside the orchestrator, because Branch's planner needed deterministic JSON-schema output (`response_format: json_object`) that was simpler to control outside Guild's `task.llm` abstraction. The executor state machine is in `apps/web/src/lib/orchestrator/run.ts` today, not `services/agents/executor/`.

**Pitch (Guild.ai)**
We're transparent: in the final demo, Guild's SDK is the planned entry point but isn't on the hot path. Happy to either rewire through `@guildai/agents-sdk` before judging (1-2 hours) or not claim this prize. The agent architecture (planner → executor → tool calls → summary) maps cleanly onto Guild's primitives whenever we do.

---

## InsForge

**What we planned**
Self-hosted InsForge (`docker-compose`) providing auth, PostgREST, pgvector-backed semantic PR search, realtime WebSockets for the dashboard trace, S3 storage for build artifacts, Deno edge functions, and AI integrations.

**Current integration state (honest)**
The adapter surface is wired (`packages/adapters/insforge/`) with `isLive()` pinging `/health`, but every data method is a stub. The dashboard's trace bus is currently an in-process pub/sub, and PR history search isn't yet hitting pgvector.

**Pitch (InsForge)**
Same posture as Guild: the adapter seam is there, the backend has a docker-compose entry, and the demo script knows how to flip to live. We're not going to pretend it's integrated for the prize submission. If there's judging time, we'd prioritize pgvector PR search (the highest-signal InsForge feature for an autonomous coding agent) before auth/storage.

---

## Not a sponsor (but powering the planner)

- **GLM 5.1** via any OpenAI-compatible endpoint (`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`). Does the actual planning — reads the issue, emits a strict-JSON plan, picks affected subgraphs. Called from `apps/web/src/lib/orchestrator/planner.ts`. Zero sponsor ties; picked because it's fast, cheap, and reliable at JSON-mode output.
