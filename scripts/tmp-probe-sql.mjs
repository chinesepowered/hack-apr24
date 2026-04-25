// Uses the rawsql debug endpoint that worked in our earlier probes.
const URL = process.env.INSFORGE_URL
const API_KEY = process.env.INSFORGE_API_KEY
const h = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
}

async function sql(stmt) {
  const r = await fetch(`${URL}/api/database/rawsql/unrestricted`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ sql: stmt }),
  })
  const body = await r.text()
  console.log('---', stmt.slice(0, 80))
  console.log(r.status, body)
  return body
}

// 1. Row count and shape
await sql(
  "SELECT pr_number, (embedding IS NULL) AS is_null, octet_length(embedding::text) AS embed_len FROM branch_pr_history WHERE repo='seed/branch-examples' LIMIT 3",
)

// 2. Invoke the RPC by hand with a string vector and see if it returns
// anything against the seed rows.
await sql(
  "SELECT pr_number, title, score FROM branch_match_pr_history((SELECT embedding FROM branch_pr_history WHERE repo='seed/branch-examples' LIMIT 1), 3)",
)

// 3. Check the ivfflat index exists
await sql(
  "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='branch_pr_history'",
)
