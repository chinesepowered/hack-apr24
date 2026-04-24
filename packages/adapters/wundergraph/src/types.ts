export interface McpTool {
  name: string
  description: string
  inputSchema: unknown
}

export interface WundergraphAdapter {
  /** List MCP tools exposed by the Cosmo Router's MCP Gateway. */
  listTools(): Promise<McpTool[]>
  /** Invoke an MCP tool (a federated GraphQL operation surfaced as a tool). */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  /** Execute a raw GraphQL operation against the Cosmo supergraph. */
  query(operation: string, variables?: Record<string, unknown>): Promise<unknown>
  isLive(): Promise<boolean>
}
