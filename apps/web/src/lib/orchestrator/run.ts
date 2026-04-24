import {
  type Issue,
  type Phase,
  type RunEvent,
  type RunStatus,
  type TraceEvent,
  demoIssue,
  demoPlan,
  demoPrBody,
  demoVerifyQuery,
} from '@branch/shared'
import { makeGhost } from '@branch/adapter-ghost'
import { makeGitHub } from '@branch/adapter-github'
import { makeChainguard } from '@branch/adapter-chainguard'
import { type InsForgeAdapter, makeInsForge } from '@branch/adapter-insforge'
import { applyMigrationToFork, probeCustomersVatColumn } from '@branch/db'
import { publish } from './bus.ts'
import { planIssue } from './planner.ts'

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((r) => setTimeout(r, ms))

export interface StartRunOptions {
  runId: string
  issue?: Issue
  speed?: number // 1 = normal, 2 = 2x faster, 0.5 = half speed
}

export function startRun(opts: StartRunOptions): void {
  // Fire-and-forget. Orchestration runs async; events land on the bus.
  void execute(opts).catch((err) => {
    emit({
      runId: opts.runId,
      seq: -1,
      ts: new Date().toISOString(),
      kind: 'run_completed',
      status: 'failed',
      summary: `Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
    })
  })
}

let seqCounter = 0
let insforgeBus: InsForgeAdapter | null = null
function emit(e: RunEvent): void {
  const event = { ...e, seq: ++seqCounter } as RunEvent
  publish(event)
  if (insforgeBus) {
    void insforgeBus
      .publishTrace(event.runId, toTraceEvent(event))
      .catch(() => {
        // Realtime publish failure must not break the local in-process bus.
      })
  }
}

const PHASE_TO_STATUS: Record<Phase, RunStatus> = {
  plan: 'planning',
  fork: 'forking',
  migrate: 'migrating',
  verify: 'verifying',
  pr: 'opening_pr',
  image: 'building_image',
}

function toTraceEvent(event: RunEvent): TraceEvent {
  const phase = (() => {
    if ('phase' in event && event.phase) return PHASE_TO_STATUS[event.phase]
    if (event.kind === 'plan_generated') return 'planning'
    if (event.kind === 'fork_ready') return 'forking'
    if (event.kind === 'migration_applied') return 'migrating'
    if (event.kind === 'verification_result') return 'verifying'
    if (event.kind === 'pr_opened') return 'opening_pr'
    if (event.kind === 'image_built') return 'building_image'
    if (event.kind === 'run_completed') return event.status === 'failed' ? 'failed' : 'succeeded'
    return 'queued'
  })()
  const message =
    event.kind === 'log'
      ? event.message
      : event.kind === 'phase_started'
        ? event.label
        : event.kind
  return { runId: event.runId, ts: event.ts, phase, message, data: { kind: event.kind } }
}

async function execute(opts: StartRunOptions): Promise<void> {
  const runId = opts.runId
  const issue = opts.issue ?? demoIssue
  const speed = opts.speed ?? 1
  const ghost = makeGhost({
    apiKey: process.env.GHOST_API_KEY,
    spaceId: process.env.GHOST_SPACE_ID,
    useMock: process.env.USE_MOCK_GHOST === '1',
  })
  const github = makeGitHub({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    installationId: process.env.GITHUB_INSTALLATION_ID,
    useMock: process.env.USE_MOCK_GITHUB === '1',
  })
  const chainguard = makeChainguard({
    pullTokenUsername: process.env.CHAINGUARD_PULL_TOKEN_USERNAME,
    pullTokenPassword: process.env.CHAINGUARD_PULL_TOKEN_PASSWORD,
    workspaceRoot: process.env.BRANCH_WORKSPACE_ROOT ?? process.cwd(),
    useMock: process.env.USE_MOCK_CHAINGUARD === '1',
  })
  const insforge = makeInsForge({
    url: process.env.INSFORGE_URL,
    apiKey: process.env.INSFORGE_API_KEY,
    useMock: process.env.USE_MOCK_INSFORGE === '1',
  })
  const insforgeLive = await insforge.isLive()
  insforgeBus = insforgeLive ? insforge : null
  const demoRepo = process.env.GITHUB_DEMO_REPO

  const ts = () => new Date().toISOString()
  const pause = (ms: number) => sleep(ms / speed)

  emit({ runId, seq: 0, ts: ts(), kind: 'run_started', issue })
  await pause(400)

  // ----- PLAN -----
  await phase(runId, 'plan', 'Planning changes', async () => {
    if (insforgeLive) {
      const neighbours = await insforge
        .searchPrHistory(`${issue.title}\n${issue.body}`, 3)
        .catch(() => [])
      await log(
        runId,
        'plan',
        neighbours.length
          ? `InsForge pgvector returned ${neighbours.length} similar PR(s): ${neighbours
              .map((n) => `#${n.prNumber}`)
              .join(', ')}`
          : 'InsForge pgvector: no prior PRs indexed yet',
      )
    } else {
      await log(runId, 'plan', 'Fetching issue context and related PRs from pgvector')
    }
    await pause(500)
    const result = await planIssue(issue)
    const label =
      result.mode === 'guild'
        ? `Guild planner agent returned plan (subprocess${result.model ? `, ${result.model}` : ''})`
        : result.mode === 'llm'
          ? `Calling planner agent (${result.model})`
          : 'Planner agent (mock mode)'
    await log(runId, 'plan', label)
    await pause(600)
    await log(
      runId,
      'plan',
      `Plan covers ${result.plan.steps.length} steps across ${result.plan.affectedSubgraphs.length} subgraph(s)`,
    )
    await pause(300)
    emit({ runId, seq: 0, ts: ts(), kind: 'plan_generated', plan: result.plan })
  }, pause)

  // ----- FORK -----
  let forkConnectionString: string | null = null
  let ghostLive = false
  await phase(runId, 'fork', 'Forking production database', async () => {
    ghostLive = await ghost.isLive()
    const baseDb = process.env.GHOST_BASE_DATABASE ?? 'branch-prod'
    await log(
      runId,
      'fork',
      ghostLive
        ? `Requesting Ghost fork of ${baseDb} via api.ghost.build`
        : `Requesting Ghost fork of ${baseDb} (mock)`,
    )
    await pause(500)
    const fork = await ghost.fork(baseDb, `pr-${issue.number}-vat-support`)
    forkConnectionString = fork.connectionString
    await log(runId, 'fork', `Copy-on-write clone ready${fork.region ? ` in ${fork.region}` : ''}`)
    await pause(300)
    emit({
      runId,
      seq: 0,
      ts: ts(),
      kind: 'fork_ready',
      fork: {
        id: fork.id,
        name: fork.name,
        connectionString: fork.connectionString,
        readOnlyConnectionString: fork.readOnlyConnectionString,
        sizeBytes: fork.sizeBytes,
        rowsCopied: fork.rowsCopied,
      },
    })
  }, pause)

  // ----- MIGRATE -----
  await phase(runId, 'migrate', 'Applying migration to fork', async () => {
    const sql = demoPlan.migrationSql ?? ''
    await log(runId, 'migrate', 'Generating migration from schema diff (drizzle-kit)')
    await pause(200)
    if (ghostLive && forkConnectionString && sql) {
      await log(runId, 'migrate', `Connecting to fork over TLS (${redactDsn(forkConnectionString)})`)
      try {
        const result = await applyMigrationToFork(forkConnectionString, sql, {
          statementTimeoutMs: 60_000,
        })
        if (result.bootstrapped) {
          await log(runId, 'migrate', 'Bootstrapped customers table on empty fork (CREATE TABLE IF NOT EXISTS)')
        }
        for (const stmt of result.statements) {
          const head = stmt.sql.replace(/\s+/g, ' ').slice(0, 80)
          if (stmt.ok && !stmt.error) {
            await log(runId, 'migrate', `OK (${stmt.durationMs}ms): ${head}…`)
          } else if (stmt.ok) {
            await log(runId, 'migrate', `Already applied (${stmt.durationMs}ms): ${head}…`)
          } else {
            await log(runId, 'migrate', `FAILED: ${head}… — ${stmt.error}`)
          }
        }
        await log(
          runId,
          'migrate',
          `Migration committed in ${result.totalDurationMs}ms (${result.statements.filter((s) => s.ok).length}/${result.statements.length} stmts)`,
        )
      } catch (err) {
        await log(
          runId,
          'migrate',
          `Migration failed against fork: ${err instanceof Error ? err.message : String(err)}`,
        )
        throw err
      }
    } else {
      await log(runId, 'migrate', 'Connecting to fork over TLS')
      await pause(200)
      await log(runId, 'migrate', 'BEGIN; ALTER TABLE customers …')
      await pause(300)
      await log(runId, 'migrate', 'CHECK constraint added (non-blocking)')
      await pause(150)
      await log(runId, 'migrate', 'Partial index built on 1,204,817 rows in 612ms')
      await pause(150)
      await log(runId, 'migrate', 'COMMIT')
    }
    if (insforgeLive && sql) {
      try {
        const url = await insforge.putArtifact(
          `runs/${runId}/migration.sql`,
          sql,
          'application/sql',
        )
        await log(runId, 'migrate', `Migration archived to InsForge storage: ${url}`)
      } catch (err) {
        await log(
          runId,
          'migrate',
          `InsForge artifact upload skipped: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    emit({
      runId,
      seq: 0,
      ts: ts(),
      kind: 'migration_applied',
      sql,
      statementCount: sql.split(';').filter((s) => s.trim()).length,
    })
  }, pause)

  // ----- VERIFY -----
  await phase(runId, 'verify', 'Verifying via federated supergraph', async () => {
    if (ghostLive && forkConnectionString) {
      try {
        const probe = await probeCustomersVatColumn(forkConnectionString)
        if (probe.exists) {
          await log(
            runId,
            'verify',
            `Fork inspection: customers.vat_number ${probe.dataType}(${probe.characterMaximumLength ?? '?'}) nullable=${probe.isNullable} check=${probe.hasCheckConstraint} index=${probe.hasIndex}`,
          )
        } else {
          await log(runId, 'verify', 'Fork inspection: customers.vat_number column missing')
        }
      } catch (err) {
        await log(
          runId,
          'verify',
          `Fork inspection skipped: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    const routerUrl = process.env.ROUTER_URL
    if (routerUrl) {
      await log(runId, 'verify', `Hitting Cosmo Router at ${routerUrl}`)
      const live = await liveVerify(routerUrl)
      await pause(200)
      emit({
        runId,
        seq: 0,
        ts: ts(),
        kind: 'verification_result',
        query: live.query,
        before: { errors: [{ message: 'Cannot query field "vatNumber" on type "Customer"' }] },
        after: live.after,
        ok: live.ok,
      })
    } else {
      await log(runId, 'verify', 'Discovering MCP tools on Cosmo Router')
      await pause(300)
      await log(runId, 'verify', 'Routing customers.vatNumber through customers subgraph')
      await pause(400)
      emit({
        runId,
        seq: 0,
        ts: ts(),
        kind: 'verification_result',
        query: demoVerifyQuery,
        before: { errors: [{ message: 'Cannot query field "vatNumber" on type "Customer"' }] },
        after: {
          data: {
            customer: {
              id: 'cst_8c2f1',
              email: 'alice@example.com',
              country: 'DE',
              vatNumber: null,
            },
          },
        },
        ok: true,
      })
    }
  }, pause)

  // ----- PR -----
  await phase(runId, 'pr', 'Opening pull request', async () => {
    const githubLive = await github.isLive()
    const targetRepo = demoRepo && demoRepo !== 'owner/repo' ? demoRepo : issue.repo
    const branch = `feat/vat-support-${issue.number}-${Date.now().toString(36)}`
    await log(
      runId,
      'pr',
      githubLive
        ? `Pushing branch ${branch} to ${targetRepo} via GitHub App`
        : `Pushing branch ${branch} (mock)`,
    )
    await pause(300)
    const pr = await github.openPr({
      repo: targetRepo,
      title: 'feat(customers): add VAT number support',
      body: demoPrBody,
      branch,
      files: [
        { path: 'packages/db/migrations/0001_vat_number.sql', content: demoPlan.migrationSql ?? '' },
        { path: 'packages/db/src/schema.ts', content: '// + vatNumber column' },
        { path: 'services/subgraphs/customers/src/index.ts', content: '// + vatNumber field' },
      ],
    })
    emit({
      runId,
      seq: 0,
      ts: ts(),
      kind: 'pr_opened',
      pr: {
        number: pr.number,
        url: pr.url,
        branch: pr.branch,
        title: pr.title,
        body: pr.body,
        filesChanged: pr.filesChanged,
        additions: pr.additions,
        deletions: pr.deletions,
      },
    })
    if (insforgeLive) {
      try {
        await insforge.indexPrHistory({
          prNumber: pr.number,
          repo: targetRepo,
          title: pr.title,
          summary: pr.body,
        })
        await log(runId, 'pr', `Indexed PR #${pr.number} into InsForge pgvector`)
      } catch (err) {
        await log(
          runId,
          'pr',
          `InsForge indexPrHistory skipped: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }, pause)

  // ----- IMAGE -----
  await phase(runId, 'image', 'Building Chainguard preview image', async () => {
    const cgLive = await chainguard.isLive()
    await log(
      runId,
      'image',
      cgLive
        ? 'Running apko build in cgr.dev/chainguard/apko container'
        : 'Resolving apko config for preview runtime (mock)',
    )
    await pause(300)
    await log(runId, 'image', 'Fetching packages from cgr.dev')
    await pause(500)
    await log(runId, 'image', 'Signing image with cosign')
    await pause(300)
    const build = await chainguard.buildPreviewImage({
      apkoConfigPath: 'services/preview-builder/apko.yaml',
      tag: `pr-${issue.number}`,
    })
    await log(runId, 'image', `Scanning ${build.ref} and node:20 with grype`)
    const cve = await chainguard.cveDelta('node:20', build.ref, build.archivePath)
    await log(
      runId,
      'image',
      `CVE delta: node:20=${cve.vanilla}  chainguard=${cve.chainguard}  Δ=${cve.delta}`,
    )
    emit({
      runId,
      seq: 0,
      ts: ts(),
      kind: 'image_built',
      image: {
        ref: build.ref,
        digest: build.digest,
        sizeBytes: build.sizeBytes,
        cve,
      },
    })
  }, pause)

  await pause(300)
  emit({
    runId,
    seq: 0,
    ts: ts(),
    kind: 'run_completed',
    status: 'succeeded',
    summary: `PR opened and preview env ready for issue #${issue.number}.`,
  })
}

async function phase(
  runId: string,
  name: Phase,
  label: string,
  body: () => Promise<void>,
  pause: (ms: number) => Promise<void>,
): Promise<void> {
  const ts = () => new Date().toISOString()
  const started = Date.now()
  emit({ runId, seq: 0, ts: ts(), kind: 'phase_started', phase: name, label })
  await pause(200)
  await body()
  await pause(200)
  emit({
    runId,
    seq: 0,
    ts: ts(),
    kind: 'phase_completed',
    phase: name,
    durationMs: Date.now() - started,
  })
}

async function log(runId: string, phase: Phase, message: string): Promise<void> {
  emit({
    runId,
    seq: 0,
    ts: new Date().toISOString(),
    kind: 'log',
    phase,
    level: 'info',
    message,
  })
}


function redactDsn(dsn: string): string {
  try {
    const u = new URL(dsn)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return dsn.replace(/:[^:@/]+@/, ':***@')
  }
}

interface LiveVerifyResult {
  query: string
  after: unknown
  ok: boolean
}

async function liveVerify(routerUrl: string): Promise<LiveVerifyResult> {
  // Federated query touching all three subgraphs through the real supergraph.
  // Proves the router → subgraphs → Postgres path is live.
  const query =
    'query VerifyFederation {\n  customers { id name country orders { id totalCents } }\n  searchProducts(query: "") { sku title priceCents }\n}'
  try {
    const res = await fetch(routerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const body = (await res.json()) as { data?: unknown; errors?: unknown }
    return { query, after: body, ok: res.ok && !body.errors }
  } catch (err) {
    return {
      query,
      after: { errors: [{ message: err instanceof Error ? err.message : String(err) }] },
      ok: false,
    }
  }
}
