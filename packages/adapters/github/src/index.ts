import { GitHubLive } from './live.ts'
import { GitHubMock } from './mock.ts'
import type { GitHubAdapter } from './types.ts'

export type { GitHubAdapter, FileChange, OpenedPr } from './types.ts'
export { GitHubLive, GitHubMock }

export function makeGitHub(opts: {
  appId?: string
  privateKey?: string
  installationId?: string
  useMock?: boolean
}): GitHubAdapter {
  if (opts.useMock || !opts.appId || !opts.privateKey || !opts.installationId) {
    return new GitHubMock()
  }
  return new GitHubLive({
    appId: opts.appId,
    privateKey: opts.privateKey,
    installationId: opts.installationId,
  })
}
