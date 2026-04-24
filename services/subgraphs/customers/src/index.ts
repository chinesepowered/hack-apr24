import SchemaBuilder from '@pothos/core'
import DirectivesPlugin from '@pothos/plugin-directives'
import FederationPlugin from '@pothos/plugin-federation'
import { createClient, customers } from '@branch/db'
import { eq } from 'drizzle-orm'
import { graphql } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

interface Customer {
  id: string
  email: string
  name: string
  country: string
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://branch:branch@localhost:5432/branch_prod'
const { db } = createClient(connectionString)

const builder = new SchemaBuilder<{
  Objects: { Customer: Customer }
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
})

const CustomerRef = builder.objectRef<Customer>('Customer').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name'),
    country: t.exposeString('country'),
  }),
})

builder.asEntity(CustomerRef, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (ref) => loadCustomer(ref.id),
})

builder.queryType({
  fields: (t) => ({
    customer: t.field({
      type: 'Customer',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_, args) => loadCustomer(String(args.id)),
    }),
    customers: t.field({
      type: ['Customer'],
      resolve: () => listCustomers(),
    }),
  }),
})

async function loadCustomer(id: string): Promise<Customer | null> {
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  const row = rows[0]
  return row ? { id: row.id, email: row.email, name: row.name, country: row.country } : null
}

async function listCustomers(): Promise<Customer[]> {
  const rows = await db.select().from(customers)
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, country: r.country }))
}

const schema = builder.toSubGraphSchema({})

if (process.argv.includes('--print-schema')) {
  const result = await graphql({ schema, source: '{ _service { sdl } }' })
  const sdl = (result.data as { _service: { sdl: string } } | null)?._service.sdl ?? ''
  const out = process.env.SCHEMA_OUT
  if (out) writeFileSync(out, sdl)
  else process.stdout.write(sdl)
  process.exit(0)
}

const yoga = createYoga({ schema })
const port = Number(process.env.PORT ?? 4001)
createServer(yoga).listen(port, () => {
  console.log(`[subgraph:customers] http://localhost:${port}/graphql`)
})
