import SchemaBuilder from '@pothos/core'
import DirectivesPlugin from '@pothos/plugin-directives'
import FederationPlugin from '@pothos/plugin-federation'
import { createClient, products } from '@branch/db'
import { eq, ilike } from 'drizzle-orm'
import { graphql } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

interface Product {
  sku: string
  title: string
  priceCents: number
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://branch:branch@localhost:5432/branch_prod'
const { db } = createClient(connectionString)

const builder = new SchemaBuilder<{
  Objects: { Product: Product }
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
})

const ProductRef = builder.objectRef<Product>('Product').implement({
  fields: (t) => ({
    sku: t.exposeID('sku'),
    title: t.exposeString('title'),
    priceCents: t.exposeInt('priceCents'),
  }),
})

builder.asEntity(ProductRef, {
  key: builder.selection<{ sku: string }>('sku'),
  resolveReference: (ref) => loadProduct(ref.sku),
})

builder.queryType({
  fields: (t) => ({
    searchProducts: t.field({
      type: ['Product'],
      args: { query: t.arg.string({ required: true }) },
      resolve: (_, args) => searchProducts(String(args.query)),
    }),
  }),
})

async function loadProduct(sku: string): Promise<Product | null> {
  const rows = await db.select().from(products).where(eq(products.sku, sku)).limit(1)
  const row = rows[0]
  return row ? { sku: row.sku, title: row.title, priceCents: row.priceCents } : null
}

async function searchProducts(q: string): Promise<Product[]> {
  const rows = q
    ? await db.select().from(products).where(ilike(products.title, `%${q}%`))
    : await db.select().from(products)
  return rows.map((r) => ({ sku: r.sku, title: r.title, priceCents: r.priceCents }))
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
const port = Number(process.env.PORT ?? 4003)
createServer(yoga).listen(port, () => {
  console.log(`[subgraph:catalog] http://localhost:${port}/graphql`)
})
