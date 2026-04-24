export interface ForkedDatabase {
  id: string
  name: string
  connectionString: string
  readOnlyConnectionString?: string
  createdAt: string
  sizeBytes?: number
  rowsCopied?: number
  region?: string
}

export interface GhostAdapter {
  /** Create a fork of a source database. Returns connection details for the fork. */
  fork(sourceName: string, forkName: string): Promise<ForkedDatabase>
  /** Irreversibly delete a fork. */
  discard(name: string): Promise<void>
  /** List databases in the authenticated space. */
  list(): Promise<{ name: string; id: string }[]>
  /** Health check used by the adapter factory to auto-fallback to mock. */
  isLive(): Promise<boolean>
}
