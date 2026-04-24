import type { TraceEvent } from '@branch/shared'
import { InsForgeClient } from '@insforge/sdk'
import type { InsForgeAdapter } from './types.ts'

const ARTIFACT_BUCKET = process.env.INSFORGE_BUCKET ?? 'branch-artifacts'
const PR_TABLE = 'branch_pr_history'
const EMBED_MODEL = process.env.INSFORGE_EMBED_MODEL ?? 'openai/text-embedding-3-small'
const RPC_MATCH = 'branch_match_pr_history'

const channelFor = (runId: string): string => `branch:run:${runId}`

// Live adapter backed by @insforge/sdk: realtime via socket.io, storage via
// presigned uploads, embeddings via the AI gateway, pgvector via a stored RPC.
// Bootstrap SQL is documented in packages/adapters/insforge/sql/bootstrap.sql.
export class InsForgeLive implements InsForgeAdapter {
  private readonly client: InsForgeClient
  private connectPromise: Promise<void> | null = null

  constructor(url: string, apiKey: string) {
    this.client = new InsForgeClient({ baseUrl: url, anonKey: apiKey, isServerMode: true })
  }

  async publishTrace(runId: string, event: TraceEvent): Promise<void> {
    await this.ensureConnected()
    await this.client.realtime.publish(channelFor(runId), 'trace', event)
  }

  subscribeTrace(runId: string, handler: (event: TraceEvent) => void): () => void {
    const channel = channelFor(runId)
    const wrapped = (msg: { payload?: TraceEvent } | TraceEvent): void => {
      const payload = (msg as { payload?: TraceEvent }).payload ?? (msg as TraceEvent)
      try {
        handler(payload)
      } catch {
        // listener errors are absorbed — stream lifecycle handled upstream
      }
    }
    void this.ensureConnected().then(() => this.client.realtime.subscribe(channel))
    this.client.realtime.on('trace', wrapped)
    return () => {
      this.client.realtime.off('trace', wrapped)
      this.client.realtime.unsubscribe(channel)
    }
  }

  async putArtifact(
    key: string,
    content: string | Uint8Array,
    contentType?: string,
  ): Promise<string> {
    const bucket = this.client.storage.from(ARTIFACT_BUCKET)
    const part = typeof content === 'string' ? content : new Uint8Array(content).buffer
    const blob = new Blob([part as ArrayBuffer | string], {
      type: contentType ?? 'application/octet-stream',
    })
    const { data, error } = await bucket.upload(key, blob)
    if (error) throw new Error(`InsForge storage upload failed: ${error.message}`)
    return (data as { url?: string } | null)?.url ?? bucket.getPublicUrl(key)
  }

  async indexPrHistory(pr: {
    prNumber: number
    repo: string
    title: string
    summary: string
  }): Promise<void> {
    const embedding = await this.embed(`${pr.title}\n\n${pr.summary}`)
    const { error } = await this.client.database.from(PR_TABLE).insert({
      pr_number: pr.prNumber,
      repo: pr.repo,
      title: pr.title,
      summary: pr.summary,
      embedding,
    })
    if (error) throw new Error(`InsForge insert failed: ${error.message}`)
  }

  async searchPrHistory(
    query: string,
    k = 5,
  ): Promise<
    { prNumber: number; repo: string; title: string; summary: string; score: number }[]
  > {
    const embedding = await this.embed(query)
    const { data, error } = await this.client.database.rpc(RPC_MATCH, {
      query_embedding: embedding,
      match_count: k,
    })
    if (error) {
      // Table/RPC not bootstrapped — surface as empty rather than fail the run.
      return []
    }
    const rows = (data ?? []) as Array<{
      pr_number: number
      repo: string
      title: string
      summary: string
      score: number
    }>
    return rows.map((r) => ({
      prNumber: r.pr_number,
      repo: r.repo,
      title: r.title,
      summary: r.summary,
      score: r.score,
    }))
  }

  async isLive(): Promise<boolean> {
    try {
      const http = this.client.getHttpClient()
      await http.get('/api/metadata')
      return true
    } catch {
      return false
    }
  }

  private async embed(text: string): Promise<number[]> {
    const res = (await this.client.ai.embeddings.create({
      model: EMBED_MODEL,
      input: text,
    })) as { data?: Array<{ embedding: number[] }> }
    const vec = res.data?.[0]?.embedding
    if (!vec) throw new Error('InsForge embeddings response missing data[0].embedding')
    return vec
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.client.realtime.connect().catch((err) => {
        this.connectPromise = null
        throw err
      })
    }
    return this.connectPromise
  }
}
