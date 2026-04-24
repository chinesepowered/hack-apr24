import type { FileChange, GitHubAdapter, OpenedPr } from './types.ts'

export class GitHubMock implements GitHubAdapter {
  private counter = 481

  async openPr(params: {
    repo: string
    title: string
    body: string
    branch: string
    baseBranch?: string
    files: FileChange[]
  }): Promise<OpenedPr> {
    const number = ++this.counter
    const additions = params.files.reduce(
      (sum, f) => sum + f.content.split('\n').length,
      0,
    )
    return {
      number,
      url: `https://github.com/${params.repo}/pull/${number}`,
      branch: params.branch,
      title: params.title,
      body: params.body,
      filesChanged: params.files.length,
      additions,
      deletions: Math.max(0, Math.floor(additions * 0.05)),
    }
  }

  async commentPr(_params: { repo: string; number: number; body: string }): Promise<void> {
    // Silent in demo
  }

  async isLive(): Promise<boolean> {
    return false
  }
}
