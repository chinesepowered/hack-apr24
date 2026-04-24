import type { McpTool, WundergraphAdapter } from './types.ts'

const MOCK_TOOLS: McpTool[] = [
  {
    name: 'customers_byId',
    description: 'Look up a customer by id across the customers subgraph.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
  },
  {
    name: 'orders_forCustomer',
    description: 'Get orders for a customer, joined with catalog items via federation.',
    inputSchema: { type: 'object', properties: { customerId: { type: 'string' } } },
  },
  {
    name: 'catalog_search',
    description: 'Search the product catalog.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  },
]

export class WundergraphMock implements WundergraphAdapter {
  async listTools(): Promise<McpTool[]> {
    return MOCK_TOOLS
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'customers_byId':
        return { id: args.id, email: 'demo@example.com', country: 'DE', vatNumber: null }
      case 'orders_forCustomer':
        return [{ id: 'o_1', total: 4200, items: [{ sku: 'SKU-1', qty: 2 }] }]
      case 'catalog_search':
        return [{ sku: 'SKU-1', title: 'Demo Widget', priceCents: 2100 }]
      default:
        throw new Error(`Unknown mock tool: ${name}`)
    }
  }

  async query(_op: string, _vars?: Record<string, unknown>): Promise<unknown> {
    return { data: { ok: true } }
  }

  async isLive(): Promise<boolean> {
    return false
  }
}
