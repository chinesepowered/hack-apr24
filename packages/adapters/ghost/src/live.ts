import type { ForkedDatabase, GhostAdapter } from './types.ts'

const API_BASE = 'https://api.ghost.build/v0'

export class GhostLive implements GhostAdapter {
  constructor(private readonly apiKey: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    })
    if (!res.ok) {
      throw new Error(`Ghost API ${res.status} ${res.statusText}: ${await res.text()}`)
    }
    return (await res.json()) as T
  }

  async fork(sourceName: string, forkName: string): Promise<ForkedDatabase> {
    // NOTE: exact path/payload will be finalized against https://api.ghost.build/v0 docs.
    const fork = await this.req<{
      id: string
      name: string
      connection_string: string
      created_at: string
    }>(`/databases/${encodeURIComponent(sourceName)}/fork`, {
      method: 'POST',
      body: JSON.stringify({ name: forkName }),
    })
    return {
      id: fork.id,
      name: fork.name,
      connectionString: fork.connection_string,
      createdAt: fork.created_at,
    }
  }

  async discard(name: string): Promise<void> {
    await this.req(`/databases/${encodeURIComponent(name)}`, { method: 'DELETE' })
  }

  async list(): Promise<{ name: string; id: string }[]> {
    const dbs = await this.req<{ items: { id: string; name: string }[] }>('/databases')
    return dbs.items.map((d) => ({ id: d.id, name: d.name }))
  }

  async isLive(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
