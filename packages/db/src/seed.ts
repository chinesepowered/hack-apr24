import { createClient, customers, orderItems, orders, products } from './index.ts'

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://branch:branch@localhost:5432/branch_prod'
  const { db, sql } = createClient(connectionString)

  const existing = await db.select().from(customers).limit(1)
  if (existing.length > 0) {
    await sql.end()
    console.log('seed: already populated, skipping')
    return
  }

  await db.insert(products).values([
    { sku: 'SKU-1', title: 'Demo Widget', priceCents: 2100 },
    { sku: 'SKU-2', title: 'Demo Gadget', priceCents: 4200 },
    { sku: 'SKU-3', title: 'Demo Gizmo', priceCents: 1000 },
  ])

  const [alice] = await db
    .insert(customers)
    .values({ email: 'alice@example.com', name: 'Alice', country: 'DE' })
    .returning()
  const [bob] = await db
    .insert(customers)
    .values({ email: 'bob@example.com', name: 'Bob', country: 'US' })
    .returning()

  if (!alice || !bob) throw new Error('seed customers failed')

  const [o1] = await db
    .insert(orders)
    .values({ customerId: alice.id, totalCents: 6300 })
    .returning()
  if (!o1) throw new Error('seed order failed')

  await db.insert(orderItems).values([
    { orderId: o1.id, sku: 'SKU-1', qty: 1 },
    { orderId: o1.id, sku: 'SKU-2', qty: 1 },
  ])

  await sql.end()
  console.log('seed: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
