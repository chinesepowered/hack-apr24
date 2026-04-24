import { ChainguardLive } from './live.ts'
import { ChainguardMock } from './mock.ts'
import type { ChainguardAdapter } from './types.ts'

export type { ChainguardAdapter, BuildResult } from './types.ts'
export { ChainguardLive, ChainguardMock }

export function makeChainguard(opts: {
  pullTokenUsername?: string
  pullTokenPassword?: string
  useMock?: boolean
}): ChainguardAdapter {
  if (opts.useMock) return new ChainguardMock()
  return new ChainguardLive(opts)
}
