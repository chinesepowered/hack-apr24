# Branch — Project Plan

> **Autonomous feature-dev agent: file a GitHub issue, get a working PR with a live forked-DB preview env in minutes.**

## 1. Pitch

A user files a GitHub issue in natural language ("add VAT support for EU customers"). A Guild.ai agent reads the issue, plans schema + code changes, forks the production Postgres via Ghost into an addressable preview environment, applies the migration, verifies behavior through a federated Wundergraph Cosmo supergraph, opens a real PR on GitHub with a live `psql` connection string attached, and posts a summary to Slack. All runs inside Chainguard-hardened containers; InsForge hosts auth, artifacts, semantic PR search, and the realtime dashboard.

## 2. Sponsor prize targets (cash only)

| Sponsor | Target | Why we win |
|---|---|---|
| Wundergraph | 1st/2nd ($2k / $1k) | Deep federation of 3 subgraphs + Cosmo Streams + MCP Gateway + schema contracts |
| Ghost | Top-5 ($500 Visa) | Fork-as-PR-preview-env is Ghost's exact vision |
| Guild.ai | 1st/2nd ($1k / $500) | 2 agent types + GitHub trigger + GitHub & Slack integrations |
| InsForge | 1st/2nd ($1k / $500) | Uses auth + pgvector + realtime + storage + AI functions + edge functions |
| Chainguard | 1st ($1k) | Per-PR apko-built preview image + Libraries pull token for supply-chain angle |

**Realistic cash ceiling: $4k–$6k.** Stretch: add TinyFish (2nd = $1k cash) if time permits.

## 3. Architecture

```
GitHub Issue → Guild Trigger (webhook)
                   ↓
              Planner Agent (LLM, GLM 5.1 via OpenAI-compatible)
                   ↓ plan JSON
              Executor Agent (self-managed state)
                   ├─ Ghost: fork prod → preview env (psql URL)
                   ├─ Drizzle: generate + apply migration on fork
                   ├─ Wundergraph Cosmo MCP: query federated supergraph
                   │      (customers + orders + catalog subgraphs)
                   ├─ GitHub: open PR w/ code + migration + psql link
                   ├─ Slack: post summary
                   └─ Chainguard apko: build per-PR preview runtime image
                   ↓
              InsForge (auth / pgvector PR search / realtime / storage / AI)
                   ↓
              Next.js 16 dashboard (live agent trace via WebSockets)
```

## 4. Tech stack

- **Language/runtime**: TypeScript 5.6 strict, Node 22 LTS
- **Package manager**: pnpm 9 workspaces + Turborepo
- **Lint/format**: Biome (single tool)
- **Frontend**: Next.js 16 (App Router, React 19), Tailwind v4, shadcn/ui, TanStack Query, Zustand, Framer Motion
- **Agents**: `@guildai/agents-sdk` + `babel-plugin-agent-compiler`; planner (LLM agent) + executor (self-managed state)
- **LLM**: GLM 5.1 via OpenAI-compatible endpoint (`OPENAI_BASE_URL` + `OPENAI_API_KEY`)
- **GraphQL**: GraphQL Yoga + Pothos; `@graphql-tools/federation` directives; Cosmo Router binary in Chainguard container
- **Event bus**: NATS (Cosmo Streams provider) — single container
- **DB**: Postgres 16 (base "prod"); Ghost for forks; node-postgres + Drizzle ORM for migrations
- **Backend platform**: self-hosted InsForge (docker-compose) — auth, PostgREST, pgvector, realtime WS, S3 storage, Deno edge functions, AI (OpenRouter)
- **Containers**: all services `FROM cgr.dev/chainguard/node:latest`; apko YAML for preview images; Chainguard Libraries pull token for `services/agents`
- **Observability**: OpenTelemetry → Jaeger (local)
- **Tunneling (demo)**: ngrok for GitHub webhook
- **Testing**: Vitest (unit/integration) + Playwright (golden-path e2e)

## 5. Monorepo layout

```
branch/
├── apps/web/                   Next.js 16 dashboard
├── services/
│   ├── agents/                 Guild agents + trigger handlers
│   ├── subgraphs/{customers,orders,catalog}/
│   ├── cosmo-router/           Router config + Dockerfile
│   └── preview-builder/        apko build helper
├── packages/
│   ├── adapters/{ghost,insforge,wundergraph,github,chainguard}/
│   ├── shared/                 zod schemas, types, env parser
│   └── db/                     seed schema + fixtures + drizzle config
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
└── .env.example
```

## 6. Sponsor integrations + doc links

- **Guild.ai** — agent SDK, triggers, integrations
  - Overview: https://docs.guild.ai/index.md
  - Agent SDK: https://docs.guild.ai/guide/sdk-introduction.md
  - LLM agents: https://docs.guild.ai/guide/llm-agents.md
  - Self-managed state agents: https://docs.guild.ai/guide/self-managed-agents.md
  - LLMs (OpenAI-compatible config): https://docs.guild.ai/guide/llms.md
  - Triggers: https://docs.guild.ai/platform/triggers.md
  - GitHub integration: https://docs.guild.ai/integrations/github.md
  - Slack integration: https://docs.guild.ai/integrations/slack.md

- **Wundergraph Cosmo** — federation + MCP + streams
  - Overview: https://cosmo-docs.wundergraph.com/overview.md
  - Tutorial: https://cosmo-docs.wundergraph.com/tutorial/from-zero-to-federation-in-5-steps-using-cosmo.md
  - MCP Gateway: https://cosmo-docs.wundergraph.com/router/mcp.md
  - MCP quickstart: https://cosmo-docs.wundergraph.com/router/mcp/quickstart.md
  - Cosmo Streams (NATS): https://cosmo-docs.wundergraph.com/router/cosmo-streams/nats.md
  - Schema contracts: https://cosmo-docs.wundergraph.com/concepts/schema-contracts.md
  - `wgc` CLI: https://cosmo-docs.wundergraph.com/cli/intro.md

- **Ghost** — fork/discard
  - Quickstart + CLI: https://ghost.build/docs/#introduction
  - `ghost create` / `ghost fork`: https://ghost.build/docs/#ghost-create
  - MCP server: https://ghost.build/docs/#ghost-mcp-install
  - HTTP API: https://ghost.build/docs/#api-reference
  - Install: `curl -fsSL https://install.ghost.build | sh`

- **InsForge** — backend platform
  - Quickstart: https://docs.insforge.dev/quickstart.md
  - TypeScript SDK overview: https://docs.insforge.dev/sdks/typescript/overview.md
  - Auth: https://docs.insforge.dev/sdks/typescript/auth.md
  - Database: https://docs.insforge.dev/sdks/typescript/database.md
  - pgvector: https://docs.insforge.dev/core-concepts/database/pgvector.md
  - Realtime: https://docs.insforge.dev/sdks/typescript/realtime.md
  - Storage: https://docs.insforge.dev/sdks/typescript/storage.md
  - AI (embeddings/chat): https://docs.insforge.dev/sdks/typescript/ai.md
  - Edge functions: https://docs.insforge.dev/core-concepts/functions/architecture.md

- **Chainguard** — images + libraries
  - Hackathon setup: https://raw.githubusercontent.com/chainguardianbb/cgstart/main/chainguard-setup.md
  - Image catalog: https://images.chainguard.dev
  - `chainctl` CLI: https://edu.chainguard.dev/chainguard/chainctl/
  - Libraries (npm pull token): https://edu.chainguard.dev/chainguard/libraries/
  - apko (declarative images): https://github.com/chainguard-dev/apko

## 7. Fallback strategy (per-sponsor mock)

Every external sponsor is wrapped in an adapter interface under `packages/adapters/*`. Each adapter has a `live` and `mock` implementation selected by env flag (`USE_MOCK_<SPONSOR>=1`) or automatic `isLive()` health-check failure.

- **Ghost mock**: returns a connection string to a pre-seeded local Postgres schema that mimics a fork.
- **Wundergraph mock**: serves static JSON responses matching the federated schema shape.
- **Guild mock**: runs agent logic in-process without Guild Cloud (same SDK, local runner).
- **InsForge mock**: uses local Postgres + in-memory pub/sub.
- **GitHub mock**: logs the "PR" to console and writes an HTML preview file.

Dashboard shows a 🟢 live / 🟡 mock badge per scene so fallbacks are visible but not broken-looking. Each demo scene is a separate route so a single sponsor failure does not cascade.

## 8. Demo flow (~90 seconds)

1. Open GitHub, file issue: *"Add VAT support for EU customers."*
2. Dashboard: Guild trigger fires → planner produces plan JSON → executor spawns.
3. Ghost fork appears with live connection string (copyable).
4. Live agent trace via InsForge Realtime: migration generated → applied on fork → federated queries via Cosmo MCP → verification passes.
5. GitHub tab: a real PR appears with diff + migration + fork `psql` URL in description.
6. On stage: `psql <fork-url>` → `\d customers` shows `vat_number` column.
7. Slack tab pings with summary.
8. Click the replay button — re-plays the same run from stored InsForge trace artifacts (demo fallback).

## 9. Build phases

1. **Scaffold**: pnpm workspaces, Turborepo, Biome, Next.js 16 app, Chainguard Dockerfiles, docker-compose skeleton, shared env parser.
2. **Seed data layer**: Postgres schema + fixtures; Drizzle config; Ghost CLI wiring and `GhostAdapter`.
3. **Federation**: 3 subgraphs with Pothos + Yoga, composed via `wgc`, Cosmo Router running with MCP Gateway enabled.
4. **Backend platform**: self-hosted InsForge in docker-compose; auth, `runs`/`artifacts`/`pr_history` tables; realtime channels; pgvector setup for PR similarity.
5. **Agents**: Guild planner + executor; GitHub trigger + Slack integration; GLM 5.1 via OpenAI-compatible client.
6. **Dashboard**: live trace UI (Framer Motion), fork URL display, PR preview, replay route, per-sponsor status badges.
7. **Streams + observability**: NATS container, Cosmo Streams event on `migrationApplied`, OTEL → Jaeger.
8. **Chainguard innovation story**: apko YAML for preview runtime image; Libraries pull token for `services/agents` with CVE-delta writeup.
9. **Polish + fallback**: mock implementations for every adapter, replay flow, scripted demo reset.

## 10. Accounts / keys needed from user

Please create + provide via `.env` (I'll read from `.env.example`):

- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` — a GitHub App installed on a demo repo with issues + PR permissions
- `GUILD_API_KEY` — https://guild.ai
- `GHOST_API_KEY` — from `ghost api-key` after `ghost login`
- `COSMO_API_KEY` — Wundergraph Cosmo Cloud API key (or we self-host)
- `INSFORGE_API_KEY` + `INSFORGE_URL` — self-hosted default `http://localhost:7130`
- `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` — Slack app in demo workspace
- `OPENAI_API_KEY` + `OPENAI_BASE_URL` — GLM 5.1 endpoint
- `CHAINGUARD_PULL_TOKEN_USERNAME` / `_PASSWORD` — from `chainctl auth pull-token --repository=javascript --ttl=720h`
- `NGROK_AUTHTOKEN` — for webhook tunnel during demo

## 11. Open risks / items to validate early

- **Guild LLM config**: confirm `@guildai/agents-sdk` accepts an OpenAI-compatible `baseURL` override for GLM 5.1. Verify first; fall back to a local OpenAI-SDK wrapper inside the agent if needed.
- **Ghost fork address reachability**: confirm forks are reachable from the host running `psql` during demo (not only from inside the Ghost cloud).
- **Cosmo Cloud vs self-host**: decide once API key is available; self-host via official docker-compose is the safer demo path.
- **InsForge self-host startup time**: validate cold start < 30s for demo reset.
- **apko build time**: must be < 60s per preview image to stay within demo pacing; otherwise pre-build and swap.
