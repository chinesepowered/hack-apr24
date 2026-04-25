#!/usr/bin/env node
// Seeds `branch_pr_history` in InsForge with realistic past PRs so the
// orchestrator's plan phase returns actual pgvector neighbours during demos.
//
// Idempotent: the seed rows are scoped to repo `seed/branch-examples` and
// re-created on every run. Real PRs indexed by the orchestrator live under
// other repo names and are untouched.
//
// Run with: `node --env-file=.env scripts/seed-insforge-pr-history.mjs`

const URL = process.env.INSFORGE_URL
const API_KEY = process.env.INSFORGE_API_KEY
const MODEL = process.env.INSFORGE_EMBED_MODEL ?? 'openai/text-embedding-3-small'
const REPO = 'seed/branch-examples'

if (!URL || !API_KEY) {
  console.error('INSFORGE_URL and INSFORGE_API_KEY must be set (source .env first).')
  process.exit(1)
}

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
}

const SEED_PRS = [
  {
    prNumber: 412,
    title: 'feat(customers): add tax_id column for B2B invoicing',
    summary:
      'Adds nullable tax_id VARCHAR(64) to customers with CHECK constraint on ISO 6166 / country-prefixed format. Backfill is a no-op (all NULL). Exposes Customer.taxId in the customers subgraph and wires it through the federated supergraph. Preview image built with apko; 0 CVEs vs node:20=1408.',
  },
  {
    prNumber: 418,
    title: 'feat(orders): support multi-currency totals',
    summary:
      'Adds currency CHAR(3) column defaulting to USD on orders, plus a total_in_usd_cents generated column driven by a rate table. Migration is online and safe on loaded tables. Orders subgraph exposes Order.currency and Order.totalUsdCents. Verified via federated query across orders + customers.',
  },
  {
    prNumber: 423,
    title: 'feat(catalog): full-text search on products',
    summary:
      'Replaces the ILIKE-based searchProducts resolver with a tsvector/GIN index over title + description. Adds search_vector column populated by a trigger. Migration is gated by a feature flag so reverting is a flag flip. Catalog subgraph keeps the same GraphQL contract; only query performance changes.',
  },
  {
    prNumber: 431,
    title: 'feat(customers): soft-delete with deleted_at',
    summary:
      'Introduces deleted_at TIMESTAMPTZ on customers with a partial index WHERE deleted_at IS NULL. Updates all customers-subgraph resolvers to filter soft-deleted rows by default and adds an includeDeleted arg for admin queries. Ghost fork preview confirms existing rows are untouched.',
  },
  {
    prNumber: 447,
    title: 'chore(db): add composite index on orders(customer_id, created_at)',
    summary:
      'Adds a concurrent btree index on orders (customer_id, created_at DESC) to accelerate the customers.orders federation field. No schema changes, no subgraph changes. Verified on Ghost fork that the query plan flips from Seq Scan to Index Scan for the top 1% of customers by order count.',
  },
  {
    prNumber: 455,
    title: 'feat(catalog): add product category taxonomy',
    summary:
      'Adds categories table and products.category_id FK with ON DELETE SET NULL. Includes a one-shot data migration that classifies existing SKUs via regex over titles (reversible). Catalog subgraph exposes Product.category and Category.products; supergraph composition updated via wgc.',
  },
]

async function embed(text) {
  const res = await fetch(`${URL}/api/ai/embeddings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ model: MODEL, input: text }),
  })
  if (!res.ok) {
    throw new Error(`embeddings ${res.status}: ${await res.text()}`)
  }
  const body = await res.json()
  const vec = body?.data?.[0]?.embedding
  if (!Array.isArray(vec)) throw new Error('embeddings response missing data[0].embedding')
  return vec
}

async function deleteSeedRows() {
  const u = `${URL}/api/database/records/branch_pr_history?repo=eq.${encodeURIComponent(REPO)}`
  const res = await fetch(u, { method: 'DELETE', headers: authHeaders })
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`delete seed rows failed ${res.status}: ${await res.text()}`)
  }
}

async function insertRows(rows) {
  const res = await fetch(`${URL}/api/database/records/branch_pr_history`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`insert failed ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function main() {
  console.log(`[seed] deleting prior seed rows in ${REPO}…`)
  await deleteSeedRows()

  console.log(`[seed] embedding ${SEED_PRS.length} PRs via ${MODEL}…`)
  const rows = []
  for (const pr of SEED_PRS) {
    const vec = await embed(`${pr.title}\n${pr.summary}`)
    rows.push({
      pr_number: pr.prNumber,
      repo: REPO,
      title: pr.title,
      summary: pr.summary,
      embedding: `[${vec.join(',')}]`,
    })
    process.stdout.write('.')
  }
  process.stdout.write('\n')

  console.log(`[seed] inserting ${rows.length} rows into branch_pr_history…`)
  const inserted = await insertRows(rows)
  console.log(`[seed] inserted ${inserted.length} row(s). Repo=${REPO}`)
}

main().catch((err) => {
  console.error('[seed] FAILED:', err)
  process.exit(1)
})
