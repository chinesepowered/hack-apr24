import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

export * from './schema.ts'
export {
  applyMigrationToFork,
  probeCustomersVatColumn,
  type ApplyMigrationResult,
  type ForkColumnProbe,
} from './fork.ts'

export function createClient(connectionString: string) {
  const sql = postgres(connectionString, { max: 10, prepare: false })
  const db = drizzle(sql, { schema })
  return { db, sql }
}
