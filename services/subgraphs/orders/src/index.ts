import SchemaBuilder from '@pothos/core'
import DirectivesPlugin from '@pothos/plugin-directives'
import FederationPlugin from '@pothos/plugin-federation'
import { createClient, orders } from '@branch/db'
import { eq } from 'drizzle-orm'
import { graphql } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

interface Order {
  id: string
  totalCents: number
  customerId: string
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://branch:branch@localhost:5432/branch_prod'
const { db } = createClient(connectionString)

const builder = new SchemaBuilder<{
  Objects: { Order: Order; Customer: { id: string } }
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
})

const CustomerRef = builder.externalRef('Customer', builder.selection<{ id: string }>('id'))
CustomerRef.implement({
  externalFields: (t) => ({ id: t.id() }),
  fields: (t) => ({
    orders: t.field({
      type: ['Order'],
      resolve: (c) => loadOrdersFor(c.id),
    }),
  }),
})

builder.objectType('Order', {
  fields: (t) => ({
    id: t.exposeID('id'),
    totalCents: t.exposeInt('totalCents'),
    customer: t.field({
      type: CustomerRef,
      resolve: (o) => ({ id: o.customerId }),
    }),
  }),
})

builder.queryType({
  fields: (t) => ({
    order: t.field({
      type: 'Order',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_, args) => loadOrder(String(args.id)),
    }),
  }),
})

function toOrder(row: { id: number; totalCents: number; customerId: string }): Order {
  return { id: String(row.id), totalCents: row.totalCents, customerId: row.customerId }
}

async function loadOrder(id: string): Promise<Order | null> {
  const n = Number(id)
  if (!Number.isFinite(n)) return null
  const rows = await db.select().from(orders).where(eq(orders.id, n)).limit(1)
  const row = rows[0]
  return row ? toOrder(row) : null
}

async function loadOrdersFor(customerId: string): Promise<Order[]> {
  const rows = await db.select().from(orders).where(eq(orders.customerId, customerId))
  return rows.map(toOrder)
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
const port = Number(process.env.PORT ?? 4002)
createServer(yoga).listen(port, () => {
  console.log(`[subgraph:orders] http://localhost:${port}/graphql`)
})
