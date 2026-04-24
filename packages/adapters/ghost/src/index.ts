import { GhostLive } from './live.ts'
import { GhostMock } from './mock.ts'
import type { GhostAdapter } from './types.ts'

export type { GhostAdapter, ForkedDatabase } from './types.ts'
export { GhostLive, GhostMock }

export function makeGhost(opts: {
  apiKey?: string
  useMock?: boolean
}): GhostAdapter {
  if (opts.useMock || !opts.apiKey) return new GhostMock()
  return new GhostLive(opts.apiKey)
}
