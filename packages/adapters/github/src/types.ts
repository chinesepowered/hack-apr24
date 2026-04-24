export interface FileChange {
  path: string
  content: string
}

export interface OpenedPr {
  number: number
  url: string
  branch: string
}

export interface GitHubAdapter {
  /** Open a PR with the given file changes on a new branch. */
  openPr(params: {
    repo: string
    title: string
    body: string
    branch: string
    baseBranch?: string
    files: FileChange[]
  }): Promise<OpenedPr>
  /** Append a comment to an existing PR or issue. */
  commentPr(params: { repo: string; number: number; body: string }): Promise<void>
  isLive(): Promise<boolean>
}
