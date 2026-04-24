import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createClient } from './index.ts'

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://branch:branch@localhost:5432/branch_prod'
  const { db, sql } = createClient(connectionString)
  const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))
  await migrate(db, { migrationsFolder })
  await sql.end()
  console.log('migrate: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
