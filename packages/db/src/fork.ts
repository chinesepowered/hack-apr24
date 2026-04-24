import postgres from 'postgres'

// Helpers used by the orchestrator's migrate + verify phases to talk directly
// to a Ghost fork. Each function opens a short-lived postgres-js client and
// closes it before returning so we don't leak pools across run iterations.

export interface ApplyMigrationResult {
  bootstrapped: boolean
  statements: { sql: string; ok: boolean; durationMs: number; error?: string }[]
  totalDurationMs: number
}

export interface ForkColumnProbe {
  exists: boolean
  dataType?: string
  characterMaximumLength?: number | null
  isNullable?: boolean
  hasCheckConstraint: boolean
  hasIndex: boolean
}

const CUSTOMERS_BOOTSTRAP = `
  CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    email varchar(256) NOT NULL UNIQUE,
    name varchar(256) NOT NULL,
    country varchar(2) NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL
  )
`

// Apply a multi-statement migration to a Ghost fork. Each statement runs in
// its own savepoint so a duplicate-column / duplicate-constraint error on
// rerun degrades to a no-op instead of aborting the whole transaction.
export async function applyMigrationToFork(
  connectionString: string,
  migrationSql: string,
  opts: { bootstrap?: boolean; statementTimeoutMs?: number } = {},
): Promise<ApplyMigrationResult> {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 15,
    ssl: connectionString.includes('sslmode=require') ? 'require' : undefined,
  })
  const t0 = Date.now()
  let bootstrapped = false
  const statements: ApplyMigrationResult['statements'] = []
  try {
    if (opts.statementTimeoutMs) {
      await sql.unsafe(`SET statement_timeout = ${opts.statementTimeoutMs}`)
    }
    if (opts.bootstrap !== false) {
      const exists = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'customers'
        ) AS exists
      `
      if (!exists[0]?.exists) {
        await sql.unsafe(CUSTOMERS_BOOTSTRAP)
        bootstrapped = true
      }
    }
    // Run each DDL statement as its own implicit transaction. We deliberately
    // avoid `sql.begin` + savepoints because postgres-js aborts the outer
    // transaction on any error inside the callback even when we ROLLBACK TO
    // SAVEPOINT. A fork is throwaway, so per-statement atomicity is fine and
    // lets reruns keep moving past benign "already exists" errors.
    for (const stmt of splitStatements(migrationSql)) {
      const start = Date.now()
      try {
        await sql.unsafe(stmt)
        statements.push({ sql: stmt, ok: true, durationMs: Date.now() - start })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const benign = /already exists|duplicate/i.test(msg)
        statements.push({
          sql: stmt,
          ok: benign,
          durationMs: Date.now() - start,
          error: benign ? undefined : msg,
        })
        if (!benign) throw err
      }
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined)
  }
  return { bootstrapped, statements, totalDurationMs: Date.now() - t0 }
}

export async function probeCustomersVatColumn(
  connectionString: string,
): Promise<ForkColumnProbe> {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 15,
    ssl: connectionString.includes('sslmode=require') ? 'require' : undefined,
  })
  try {
    const cols = await sql<
      { data_type: string; character_maximum_length: number | null; is_nullable: string }[]
    >`
      SELECT data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'vat_number'
    `
    const constraints = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conname = 'customers_vat_number_format'
    `
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'customers_vat_number_idx'
    `
    const col = cols[0]
    return {
      exists: !!col,
      dataType: col?.data_type,
      characterMaximumLength: col?.character_maximum_length ?? null,
      isNullable: col ? col.is_nullable === 'YES' : undefined,
      hasCheckConstraint: constraints.length > 0,
      hasIndex: indexes.length > 0,
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined)
  }
}

function splitStatements(sql: string): string[] {
  // Drop SQL line comments and split on `;` at statement boundaries. Good
  // enough for our migration shape (no DO blocks, no functions, no quoted
  // semicolons). For anything heavier we'd hand off to drizzle-kit.
  const stripped = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
