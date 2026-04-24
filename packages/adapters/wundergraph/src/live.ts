import type { McpTool, WundergraphAdapter } from './types.ts'

/**
 * Talks to the Cosmo Router. Router URL serves both GraphQL (for `query`)
 * and an MCP Gateway endpoint (for `listTools` / `callTool`). Exact MCP
 * transport is finalized when services/cosmo-router is wired up.
 */
export class WundergraphLive implements WundergraphAdapter {
  constructor(
    private readonly routerUrl: string,
    private readonly mcpUrl: string = routerUrl.replace(/\/graphql$/, '/mcp'),
  ) {}

  async listTools(): Promise<McpTool[]> {
    throw new Error('WundergraphLive.listTools not implemented yet')
  }

  async callTool(_name: string, _args: Record<string, unknown>): Promise<unknown> {
    throw new Error('WundergraphLive.callTool not implemented yet')
  }

  async query(operation: string, variables?: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(this.routerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: operation, variables }),
    })
    if (!res.ok) {
      throw new Error(`Cosmo Router ${res.status}: ${await res.text()}`)
    }
    return await res.json()
  }

  async isLive(): Promise<boolean> {
    try {
      const res = await fetch(this.routerUrl.replace(/\/graphql$/, '/health'))
      return res.ok
    } catch {
      return false
    }
  }
}
