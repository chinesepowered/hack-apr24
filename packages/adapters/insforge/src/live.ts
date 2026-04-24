import type { TraceEvent } from '@branch/shared'
import type { InsForgeAdapter } from './types.ts'

/**
 * Thin placeholder for the real InsForge integration. When the InsForge
 * TypeScript SDK is wired up this will delegate to @insforge/sdk for
 * auth, database, realtime, storage, ai, and edge functions.
 */
export class InsForgeLive implements InsForgeAdapter {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async publishTrace(_runId: string, _event: TraceEvent): Promise<void> {
    throw new Error('InsForgeLive.publishTrace not implemented yet')
  }

  subscribeTrace(_runId: string, _handler: (event: TraceEvent) => void): () => void {
    throw new Error('InsForgeLive.subscribeTrace not implemented yet')
  }

  async putArtifact(_key: string, _content: string | Uint8Array): Promise<string> {
    throw new Error('InsForgeLive.putArtifact not implemented yet')
  }

  async indexPrHistory(_pr: {
    prNumber: number
    repo: string
    title: string
    summary: string
  }): Promise<void> {
    throw new Error('InsForgeLive.indexPrHistory not implemented yet')
  }

  async searchPrHistory(
    _query: string,
    _k?: number,
  ): Promise<
    { prNumber: number; repo: string; title: string; summary: string; score: number }[]
  > {
    throw new Error('InsForgeLive.searchPrHistory not implemented yet')
  }

  async isLive(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/health`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
