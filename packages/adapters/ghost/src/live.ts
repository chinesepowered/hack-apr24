import type { ForkedDatabase, GhostAdapter } from './types.ts'

const API_BASE = 'https://api.ghost.build/v0'

interface GhostSpace {
  id: string
  name: string
}

interface GhostDatabase {
  id: string
  name: string
  status: string
  host: string
  port: number
  password?: string | null
  storage_mib?: number | null
}

// Live adapter against api.ghost.build/v0. The API key is scoped to one
// space, so on first use we resolve the space id from GET /spaces.
export class GhostLive implements GhostAdapter {
  private cachedSpaceId: string | null = null

  constructor(
    private readonly apiKey: string,
    private readonly opts: { spaceId?: string; pollIntervalMs?: number; pollTimeoutMs?: number } = {},
  ) {
    if (opts.spaceId) this.cachedSpaceId = opts.spaceId
  }

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
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  private async spaceId(): Promise<string> {
    if (this.cachedSpaceId) return this.cachedSpaceId
    const spaces = await this.req<GhostSpace[]>('/spaces')
    const first = spaces[0]
    if (!first) throw new Error('Ghost API key is not scoped to any space')
    this.cachedSpaceId = first.id
    return first.id
  }

  private async waitForRunning(spaceId: string, dbRef: string): Promise<GhostDatabase> {
    const interval = this.opts.pollIntervalMs ?? 3000
    const timeout = this.opts.pollTimeoutMs ?? 600_000
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const db = await this.req<GhostDatabase>(
        `/spaces/${encodeURIComponent(spaceId)}/databases/${encodeURIComponent(dbRef)}`,
      )
      if (db.status === 'running') return db
      if (['deleting', 'deleted', 'unstable'].includes(db.status)) {
        throw new Error(`Ghost fork entered terminal status ${db.status}`)
      }
      await sleep(interval)
    }
    throw new Error(`Ghost fork did not reach running within ${timeout}ms`)
  }

  async fork(sourceName: string, forkName: string): Promise<ForkedDatabase> {
    const spaceId = await this.spaceId()
    // If a fork with this name already exists (e.g. a previous run left it
    // behind because it took longer than the wait timeout), reuse it instead
    // of failing with a 409. The fork name is unique per PR in our usage.
    const existing = await this.findByName(spaceId, forkName)
    const target = existing ?? (await this.req<GhostDatabase>(
      `/spaces/${encodeURIComponent(spaceId)}/databases/${encodeURIComponent(sourceName)}/fork`,
      { method: 'POST', body: JSON.stringify({ name: forkName }) },
    ))
    const ready = target.status === 'running'
      ? target
      : await this.waitForRunning(spaceId, target.id)
    return ghostDatabaseToForked(ready)
  }

  private async findByName(spaceId: string, name: string): Promise<GhostDatabase | null> {
    const dbs = await this.req<GhostDatabase[]>(
      `/spaces/${encodeURIComponent(spaceId)}/databases`,
    )
    return dbs.find((d) => d.name === name) ?? null
  }

  async discard(name: string): Promise<void> {
    const spaceId = await this.spaceId()
    await this.req(`/spaces/${encodeURIComponent(spaceId)}/databases/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  async list(): Promise<{ name: string; id: string }[]> {
    const spaceId = await this.spaceId()
    const dbs = await this.req<GhostDatabase[]>(
      `/spaces/${encodeURIComponent(spaceId)}/databases`,
    )
    return dbs.map((d) => ({ id: d.id, name: d.name }))
  }

  async isLive(): Promise<boolean> {
    try {
      await this.req('/auth/info')
      return true
    } catch {
      return false
    }
  }
}

function ghostDatabaseToForked(db: GhostDatabase): ForkedDatabase {
  // Ghost runs on Timescale Cloud: the Postgres role is always `tsdbadmin`
  // and the default database name is `tsdb`. The Ghost name (db.name) is
  // a user-facing label that does not appear in the connection string.
  const user = 'tsdbadmin'
  const pw = db.password ?? ''
  const auth = pw ? `${user}:${encodeURIComponent(pw)}@` : `${user}@`
  const connectionString = `postgresql://${auth}${db.host}:${db.port}/tsdb?sslmode=require`
  return {
    id: db.id,
    name: db.name,
    connectionString,
    createdAt: new Date().toISOString(),
    sizeBytes: typeof db.storage_mib === 'number' ? db.storage_mib * 1024 * 1024 : undefined,
    region: db.host,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
