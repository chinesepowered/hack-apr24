# Branch — deploy & demo setup

Two paths. Pick one.

- **Path A — minimum to demo.** One action from you. Most of the stack is already real; three phases narrate with mock data.
- **Path B — fully live sponsor usage.** You provide credentials for Ghost + GitHub (+ optional Chainguard apko); I finish the `*Live` adapters and wire them into the orchestrator.

---

## Path A — minimum to demo (do this if you're about to go on stage)

**You do, once:**

1. Start Docker Desktop.

That's it. Then:

```powershell
pnpm demo:live      # boots Postgres + NATS + Cosmo router + subgraphs + web
# open http://localhost:3000  →  click "Run demo"
pnpm demo:down      # when finished
```

**Already real on this path** (no action from you):

| Component | What's live |
|---|---|
| Chainguard Postgres | `cgr.dev/chainguard/postgres` container, migrated, seeded |
| WunderGraph Cosmo Router | v0.311.0 at `:3002/graphql`, federated across 3 subgraphs |
| Cosmo MCP Gateway | `:5025/mcp`, 6 tools, backed by real Postgres |
| Cosmo Streams / NATS | NATS event provider registered in router config |
| Pothos subgraphs + Drizzle | `customers` / `orders` / `catalog` → Postgres |
| GLM 5.1 planner | `zai-org/GLM-5-FP8` via W&B Inference; key already in `.env` |
| Dashboard verify panel | hits the real router and shows live Postgres data |

**Mock fallback on this path** (auto-activates when credentials are missing):

- Ghost database fork — mock until `GHOST_API_KEY` is set (see B1).
- GitHub PR open — mock until `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_INSTALLATION_ID` are set (see B2).
- Chainguard apko preview image — real as soon as Docker is running (the adapter shells out to the `cgr.dev/chainguard/apko` container; no install needed). Forces mock with `USE_MOCK_CHAINGUARD=1`.

If you're OK with Ghost + GitHub being narrated, **Path A is all you need**. Otherwise jump to Path B.

---

## Path B — go fully live

All three `*Live` adapters are now implemented and wired into the orchestrator. Each falls back to its mock automatically when credentials are missing — so you can turn them on one at a time by populating the env vars below, no code changes required.

### B1. Ghost — real database fork 👤

The live adapter talks to `api.ghost.build/v0`: `POST /spaces/{id}/databases/{ref}/fork`, then polls until the fork reaches `running`, then reads the password back and builds a `postgres://…` connection string.

Steps:

1. Install the Ghost CLI. On Windows, run in PowerShell:
   ```powershell
   irm https://install.ghost.build/install.ps1 | iex
   ```
   (macOS/Linux/WSL: `curl -fsSL https://install.ghost.build | sh`. Homebrew: `brew install timescale/tap/ghost`. npm: `npm install -g @ghost.build/cli`.)
2. `ghost login` — opens the browser for GitHub OAuth.
3. `ghost api-key create` — copy the key it prints (it's only shown once). Tip: `ghost api-key create --env >> .env` appends `GHOST_API_KEY=…` to your `.env` in one step.
4. Create a source database to fork — the demo defaults to `branch-prod`: `ghost create --name branch-prod --wait`.
5. Make sure `.env` has:
   ```
   GHOST_API_KEY=<the key from step 3>
   GHOST_BASE_DATABASE=branch-prod
   # optional; auto-discovered from the key otherwise
   GHOST_SPACE_ID=
   ```

On the next `pnpm demo:live`, the fork-card will show the real `postgres://…@<ghost-host>:<port>/<fork-name>` connection string and the actual storage usage reported by Ghost.

### B2. GitHub — real PR opens on a demo repo 👤

The live adapter uses `@octokit/app`: creates blobs → tree → commit → ref → PR, then reads back `GET /compare/{base}...{branch}` to populate additions / deletions on the PR card.

Step-by-step — I'll wait at each prompt:

1. **Create (or pick) a demo repo**, e.g. `your-user/storefront`. It needs a `main` branch and at least one commit. If you start from scratch: `gh repo create your-user/storefront --public --add-readme`. The paths we commit (`packages/db/migrations/0001_vat_number.sql`, `packages/db/src/schema.ts`, `services/subgraphs/customers/src/index.ts`) do not need to pre-exist — the git-data API just creates them.
2. **Create a GitHub App** at https://github.com/settings/apps/new
   - Name: `Branch Dev` (or anything).
   - Homepage URL: `http://localhost:3000`.
   - Webhook: **uncheck "Active"** (we don't need incoming webhooks for the demo).
   - **Repository permissions**:
     - Contents → Read & write
     - Pull requests → Read & write
     - Issues → Read-only
     - Metadata → Read-only (auto-selected)
   - Where can this GitHub App be installed: **Only on this account**.
   - Click **Create GitHub App**.
3. On the new app's page, scroll to **Private keys** → **Generate a private key**. A `.pem` file downloads.
4. In the left sidebar click **Install App** → **Install** → choose **Only select repositories** → pick `your-user/storefront` → **Install**.
5. After installing, the URL bar will look like `https://github.com/settings/installations/99999999`. Copy that number.
6. Populate `.env` (paste the `.pem` contents; if PowerShell eats the newlines, replace them with `\n` literals — the adapter decodes both):
   ```
   GITHUB_APP_ID=<App ID from the app's "About" section>
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n…\n-----END RSA PRIVATE KEY-----\n"
   GITHUB_INSTALLATION_ID=<number from step 5>
   GITHUB_DEMO_REPO=your-user/storefront
   ```

On the next `pnpm demo:live`, the PR card will link to a real PR on your repo, with a branch name like `feat/vat-support-101-lk7x2c` (issue number + a nonce, so re-runs don't collide).

### B3. Chainguard — real apko preview image 👤

The live adapter shells out to the official `cgr.dev/chainguard/apko` container (no local install) to build `services/preview-builder/apko.yaml` into an OCI tarball, loads it into your Docker daemon, and reports the real digest / size. CVE counts come from the Chainguard `grype` container.

✅ Pull token is already in `.env`. No further action needed — the adapter auto-enables when Docker is running. The image-card will show a real `branch/preview:pr-<n>` ref + `sha256:…` digest after the first demo run.

> Note: the first apko run pulls `cgr.dev/chainguard/apko` + `cgr.dev/chainguard/grype` and fetches Wolfi packages, so it takes ~1-2 minutes. Subsequent runs are fast.

### B4. InsForge, Guild.ai — skip unless you want them

Neither is on the critical demo path. Tell me if you want them live and I'll estimate the effort.

---

## Cosmo MCP — point your LLM at it

Already running. Connect Claude Desktop / Cursor / any MCP client:

```json
{
  "mcpServers": {
    "branch": { "transport": "http", "url": "http://localhost:5025/mcp" }
  }
}
```

Tools exposed: `execute_graphql`, `execute_operation_{get_customer_by_id,list_customers,search_products}`, `get_operation_info`, `get_schema`.

---

## Reference — what I've already handled

- Pulled & started Chainguard Postgres; ran Drizzle migrations + seed
- Built the Cosmo Router Docker image (custom wolfi-base)
- Composed `supergraph.json` from live subgraph SDL
- Enabled MCP + NATS event providers in `services/cosmo-router/config.yaml`
- Wrote 3 persisted GraphQL operations under `services/cosmo-router/operations/`
- Wired `pnpm demo:live` to load the monorepo-root `.env` so the GLM planner runs

---

## TL;DR — the one question

- **"I just want to demo as-is"** → start Docker, run `pnpm demo:live`. Done.
- **"Make Ghost + GitHub + Chainguard real"** → send me the creds from B1/B2/B3 and I'll ship it.
