import type { ForkedDatabase, GhostAdapter } from './types.ts'

export interface GhostForkDetails extends ForkedDatabase {
  sizeBytes: number
  rowsCopied: number
  region: string
}

export class GhostMock implements GhostAdapter {
  private readonly forks = new Map<string, GhostForkDetails>()

  async fork(sourceName: string, forkName: string): Promise<GhostForkDetails> {
    const id = `frk_${Math.random().toString(36).slice(2, 10)}`
    const region = 'eu-central-1'
    const fork: GhostForkDetails = {
      id,
      name: forkName,
      connectionString: `postgres://branch:${mask()}@ghost-eu.branch.build:5432/${forkName}`,
      readOnlyConnectionString: `postgres://branch_ro:${mask()}@ghost-eu-ro.branch.build:5432/${forkName}`,
      createdAt: new Date().toISOString(),
      sizeBytes: 248_512_000,
      rowsCopied: 1_204_817,
      region,
    }
    this.forks.set(forkName, fork)
    return fork
  }

  async discard(name: string): Promise<void> {
    this.forks.delete(name)
  }

  async list(): Promise<{ name: string; id: string }[]> {
    return [...this.forks.values()].map((f) => ({ id: f.id, name: f.name }))
  }

  async isLive(): Promise<boolean> {
    return false
  }
}

function mask(): string {
  return '••••••••'
}
