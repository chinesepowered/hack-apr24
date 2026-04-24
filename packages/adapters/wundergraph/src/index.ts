import { WundergraphLive } from './live.ts'
import { WundergraphMock } from './mock.ts'
import type { WundergraphAdapter } from './types.ts'

export type { WundergraphAdapter, McpTool } from './types.ts'
export { WundergraphLive, WundergraphMock }

export function makeWundergraph(opts: {
  routerUrl?: string
  useMock?: boolean
}): WundergraphAdapter {
  if (opts.useMock || !opts.routerUrl) return new WundergraphMock()
  return new WundergraphLive(opts.routerUrl)
}
