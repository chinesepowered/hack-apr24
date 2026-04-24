import type { TraceEvent } from '@branch/shared'

export interface InsForgeAdapter {
  /** Publish a trace event to a realtime channel for a given run. */
  publishTrace(runId: string, event: TraceEvent): Promise<void>
  /** Subscribe to trace events for a run (used by dashboard server). */
  subscribeTrace(runId: string, handler: (event: TraceEvent) => void): () => void
  /** Persist an artifact (migration sql, diff, logs) to storage. */
  putArtifact(key: string, content: string | Uint8Array, contentType?: string): Promise<string>
  /** Embed and insert a PR summary for later semantic search. */
  indexPrHistory(params: {
    prNumber: number
    repo: string
    title: string
    summary: string
  }): Promise<void>
  /** pgvector similarity search over past PRs. */
  searchPrHistory(query: string, k?: number): Promise<
    { prNumber: number; repo: string; title: string; summary: string; score: number }[]
  >
  isLive(): Promise<boolean>
}
