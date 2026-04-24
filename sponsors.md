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

**What we use**
- `services/agents/planner` is a canonical Guild coded agent: `"use agent"` directive on top of `src/agent.ts`, `agent({ description, inputSchema, outputSchema, run })` as the default export, Zod schemas for both ends of the contract, and `progressLogNotifyEvent` wired through `task.ui.notify` for live progress.
- `services/agents/executor` follows the same shape — same directive, same factory, same notification surface — for the apply-migration step.
- The orchestrator's plan phase spawns the planner as a real subprocess (`node --import tsx/esm src/agent.ts`) and parses the JSON plan from stdout. That's the **same code path** that runs after `guild agent deploy`; locally the SDK is loaded via dynamic import so a missing `@guildai/agents-sdk` (i.e. before `guild auth login`) gracefully degrades to direct CLI execution rather than blocking the demo.
- Optional dependency `@guildai/agents-sdk` is declared in both agents' `package.json` so `guild auth login && npm install` flips them onto Guild Hub primitives without code changes.

**Where it appears in the demo**
- The dashboard's plan log line reads "Guild planner agent returned plan (subprocess, …)" when the agent runs successfully — visible proof that the plan came out of a separate Node process driven by Guild conventions, not an in-process function call.
- Toggle `GUILD_PLANNER_DISABLED=1` to see the same plan come from the in-process LLM path; the same JSON schema flows through either way.

**Pitch (Guild.ai)**
*"The planner is an actual Guild coded agent — `'use agent'` directive, `agent()` factory, schemas, progress notifications. Spawning it as a subprocess from the orchestrator is the local mirror of how it'd run on Guild Hub after `guild agent deploy`, so 'demo today, deploy tomorrow' is one CLI command away. We picked Guild because the agent boundary is the right unit of governance for an autonomous coding agent — the planner is a versioned artifact you can roll back, not a function buried inside an app."*

---

## InsForge

**What we use**
- `@insforge/sdk` (`InsForgeClient`, `isServerMode: true`) wired in `packages/adapters/insforge/src/live.ts`, providing **three** real surfaces:
  - **Realtime** (Socket.IO pub/sub): every orchestrator event is mirrored to channel `branch:run:<runId>` via `realtime.publish(...)`. Dashboards or external observers can subscribe to live runs without coupling to the in-process bus.
  - **Storage**: each run's `migration.sql` is uploaded to bucket `branch-artifacts`; the public URL is logged into the migrate phase trace.
  - **AI + pgvector**: the plan phase calls `searchPrHistory(issue)` and the PR phase calls `indexPrHistory(pr)`. Embeddings come from the InsForge AI gateway (`openai/text-embedding-3-small`); cosine-similarity search runs server-side via the `branch_match_pr_history` Postgres RPC defined in `packages/adapters/insforge/sql/bootstrap.sql`.
- A one-shot bootstrap SQL file (`bootstrap.sql`) installs `pgvector`, creates `branch_pr_history`, and registers the RPC. Apply once via the InsForge dashboard SQL editor.

**Where it appears in the demo**
- Plan card shows e.g. "InsForge pgvector returned 2 similar PR(s): #482, #401" when prior runs have indexed history, or "no prior PRs indexed yet" on a cold start.
- Migrate card surfaces the artifact URL once the SQL has been uploaded.
- Run termination doesn't depend on InsForge: every call is wrapped so a missing table or AI quota becomes an info-level log line, never a failed run.

**Pitch (InsForge)**
*"InsForge is a one-stop BaaS, and Branch is a one-stop control plane for shipping features — so we used three of its surfaces in three different orchestrator phases. Realtime carries the trace bus, Storage holds the migration artifacts, and the AI + pgvector pair powers the 'have we done something like this before?' lookup that materially improves planner quality. The whole integration is one SDK and one bootstrap.sql; the operational surface area we'd otherwise own (Postgres + Redis + S3 + an embeddings API) is gone."*

---

## Not a sponsor (but powering the planner)

- **GLM 5.1** via any OpenAI-compatible endpoint (`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`). Does the actual planning — reads the issue, emits a strict-JSON plan, picks affected subgraphs. Called from `apps/web/src/lib/orchestrator/planner.ts`. Zero sponsor ties; picked because it's fast, cheap, and reliable at JSON-mode output.
