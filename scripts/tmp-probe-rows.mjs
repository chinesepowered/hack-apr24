const URL = process.env.INSFORGE_URL
const API_KEY = process.env.INSFORGE_API_KEY
const h = { Authorization: `Bearer ${API_KEY}` }

const r = await fetch(
  `${URL}/api/database/records/branch_pr_history?select=id,pr_number,repo,title,embedding&repo=eq.seed/branch-examples`,
  { headers: h },
)
console.log('status', r.status)
const body = await r.json()
for (const row of body) {
  const e = row.embedding
  console.log(
    row.pr_number,
    row.title.slice(0, 50),
    'embedding:',
    e === null
      ? 'NULL'
      : typeof e === 'string'
        ? `string len=${e.length} head=${e.slice(0, 30)}`
        : Array.isArray(e)
          ? `array len=${e.length}`
          : `other typeof=${typeof e}`,
  )
}
