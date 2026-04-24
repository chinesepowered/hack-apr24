import { relations } from 'drizzle-orm'
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ----- customers subgraph -----
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  name: varchar('name', { length: 256 }).notNull(),
  country: varchar('country', { length: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ----- catalog subgraph -----
export const products = pgTable('products', {
  sku: varchar('sku', { length: 64 }).primaryKey(),
  title: varchar('title', { length: 256 }).notNull(),
  priceCents: integer('price_cents').notNull(),
})

// ----- orders subgraph -----
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 64 })
    .notNull()
    .references(() => products.sku),
  qty: integer('qty').notNull(),
})

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.sku], references: [products.sku] }),
}))

// ----- branch control-plane tables (operational) -----
export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueNumber: integer('issue_number').notNull(),
  repo: varchar('repo', { length: 256 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  forkName: varchar('fork_name', { length: 128 }),
  prNumber: integer('pr_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const artifacts = pgTable('artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 32 }).notNull(),
  key: text('key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
