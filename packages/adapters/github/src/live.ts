import type { FileChange, GitHubAdapter, OpenedPr } from './types.ts'

/**
 * Placeholder for the GitHub App integration. Will use @octokit/app with
 * the installation id to create a branch, commit files via the git data API,
 * and open a PR.
 */
export class GitHubLive implements GitHubAdapter {
  constructor(
    private readonly opts: {
      appId: string
      privateKey: string
      installationId: string
    },
  ) {}

  async openPr(_params: {
    repo: string
    title: string
    body: string
    branch: string
    baseBranch?: string
    files: FileChange[]
  }): Promise<OpenedPr> {
    throw new Error('GitHubLive.openPr not implemented yet')
  }

  async commentPr(_params: {
    repo: string
    number: number
    body: string
  }): Promise<void> {
    throw new Error('GitHubLive.commentPr not implemented yet')
  }

  async isLive(): Promise<boolean> {
    return Boolean(this.opts.appId && this.opts.privateKey && this.opts.installationId)
  }
}
