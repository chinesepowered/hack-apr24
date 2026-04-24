import type { TraceEvent } from '@branch/shared'
import type { InsForgeAdapter } from './types.ts'

type Handler = (event: TraceEvent) => void

export class InsForgeMock implements InsForgeAdapter {
  private readonly subs = new Map<string, Set<Handler>>()
  private readonly artifacts = new Map<string, string | Uint8Array>()
  private readonly prs: {
    prNumber: number
    repo: string
    title: string
    summary: string
  }[] = []

  async publishTrace(runId: string, event: TraceEvent): Promise<void> {
    for (const h of this.subs.get(runId) ?? []) h(event)
  }

  subscribeTrace(runId: string, handler: Handler): () => void {
    if (!this.subs.has(runId)) this.subs.set(runId, new Set())
    this.subs.get(runId)!.add(handler)
    return () => this.subs.get(runId)?.delete(handler)
  }

  async putArtifact(key: string, content: string | Uint8Array): Promise<string> {
    this.artifacts.set(key, content)
    return `mock://artifact/${key}`
  }

  async indexPrHistory(pr: {
    prNumber: number
    repo: string
    title: string
    summary: string
  }): Promise<void> {
    this.prs.push(pr)
  }

  async searchPrHistory(
    query: string,
    k = 5,
  ): Promise<
    { prNumber: number; repo: string; title: string; summary: string; score: number }[]
  > {
    const q = query.toLowerCase()
    return this.prs
      .map((pr) => ({
        ...pr,
        score:
          (pr.title.toLowerCase().includes(q) ? 0.7 : 0) +
          (pr.summary.toLowerCase().includes(q) ? 0.3 : 0),
      }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
  }

  async isLive(): Promise<boolean> {
    return false
  }
}
