import { InsForgeLive } from './live.ts'
import { InsForgeMock } from './mock.ts'
import type { InsForgeAdapter } from './types.ts'

export type { InsForgeAdapter } from './types.ts'
export { InsForgeLive, InsForgeMock }

export function makeInsForge(opts: {
  url?: string
  apiKey?: string
  useMock?: boolean
}): InsForgeAdapter {
  if (opts.useMock || !opts.url || !opts.apiKey) return new InsForgeMock()
  return new InsForgeLive(opts.url, opts.apiKey)
}
