// One-shot smoke: POST /api/runs, then stream /api/runs/{id}/events
// and pretty-print every phase + key payloads. Exits non-zero on failure.

const BASE = process.env.BRANCH_BASE_URL ?? 'http://localhost:3000'

const start = await fetch(`${BASE}/api/runs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ speed: 4 }),
})
if (!start.ok) {
  console.error(`POST /api/runs failed: ${start.status} ${await start.text()}`)
  process.exit(1)
}
const { runId } = await start.json()
console.log(`[smoke] runId=${runId}`)

const res = await fetch(`${BASE}/api/runs/${runId}/events`, {
  headers: { accept: 'text/event-stream' },
})
if (!res.ok || !res.body) {
  console.error(`GET events failed: ${res.status}`)
  process.exit(1)
}

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buf = ''
let exitCode = 1
const seenPhases = new Set()
const deadline = Date.now() + 5 * 60 * 1000

while (Date.now() < deadline) {
  const { value, done } = await reader.read()
  if (done) break
  buf += decoder.decode(value, { stream: true })
  let idx
  while ((idx = buf.indexOf('\n\n')) !== -1) {
    const frame = buf.slice(0, idx)
    buf = buf.slice(idx + 2)
    if (!frame.startsWith('data: ')) continue
    const payload = frame.slice(6)
    let ev
    try { ev = JSON.parse(payload) } catch { continue }
    handle(ev)
    if (ev.kind === 'run_completed') {
      exitCode = ev.status === 'succeeded' ? 0 : 2
      console.log(`[smoke] terminal status=${ev.status} summary=${ev.summary}`)
      try { reader.cancel() } catch {}
      process.exit(exitCode)
    }
  }
}
console.error('[smoke] timed out before run_completed')
process.exit(3)

function handle(ev) {
  switch (ev.kind) {
    case 'run_started':
      console.log(`[start] issue=${ev.issue.repo}#${ev.issue.number} "${ev.issue.title}"`)
      return
    case 'phase_started':
      seenPhases.add(ev.phase)
      console.log(`[phase] -> ${ev.phase} (${ev.label})`)
      return
    case 'phase_completed':
      console.log(`[phase] OK ${ev.phase} in ${ev.durationMs}ms`)
      return
    case 'log':
      console.log(`  [${ev.phase}/${ev.level}] ${ev.message}`)
      return
    case 'artifact':
      console.log(`  [artifact:${ev.kind2 ?? ev.type ?? ''}]`, JSON.stringify(ev).slice(0, 500))
      return
    default:
      console.log(`[ev] ${ev.kind}`, JSON.stringify(ev).slice(0, 400))
  }
}
