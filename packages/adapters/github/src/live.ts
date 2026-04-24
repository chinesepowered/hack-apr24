import { App } from '@octokit/app'
import type { FileChange, GitHubAdapter, OpenedPr } from './types.ts'

// Real GitHub App integration: creates a branch, commits the given files via
// the git-data API, opens a PR, and (optionally) reports the line deltas
// returned by the compare endpoint.
export class GitHubLive implements GitHubAdapter {
  private readonly app: App

  constructor(
    private readonly opts: {
      appId: string
      privateKey: string
      installationId: string
    },
  ) {
    this.app = new App({
      appId: opts.appId,
      privateKey: normalizeKey(opts.privateKey),
    })
  }

  private async octokit() {
    return this.app.getInstallationOctokit(Number(this.opts.installationId))
  }

  async openPr(params: {
    repo: string
    title: string
    body: string
    branch: string
    baseBranch?: string
    files: FileChange[]
  }): Promise<OpenedPr> {
    const [owner, repo] = params.repo.split('/')
    if (!owner || !repo) throw new Error(`GitHubLive: invalid repo "${params.repo}", expected owner/repo`)
    const octokit = await this.octokit()

    const repoInfo = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })
    const base = params.baseBranch ?? (repoInfo.data.default_branch as string)

    const ref = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner,
      repo,
      ref: `heads/${base}`,
    })
    const baseSha = ref.data.object.sha

    const baseCommit = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
      owner,
      repo,
      commit_sha: baseSha,
    })
    const baseTreeSha = baseCommit.data.tree.sha

    const blobs = await Promise.all(
      params.files.map(async (f) => {
        const blob = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
          owner,
          repo,
          content: Buffer.from(f.content, 'utf8').toString('base64'),
          encoding: 'base64',
        })
        return { path: f.path, sha: blob.data.sha }
      }),
    )

    const tree = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: b.sha,
      })),
    })

    const commit = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
      owner,
      repo,
      message: params.title,
      tree: tree.data.sha,
      parents: [baseSha],
    })

    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: `refs/heads/${params.branch}`,
      sha: commit.data.sha,
    })

    const pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title: params.title,
      body: params.body,
      head: params.branch,
      base,
    })

    const compare = await octokit.request(
      'GET /repos/{owner}/{repo}/compare/{basehead}',
      { owner, repo, basehead: `${base}...${params.branch}` },
    )
    const files = compare.data.files ?? []
    const additions = files.reduce((s, f) => s + (f.additions ?? 0), 0)
    const deletions = files.reduce((s, f) => s + (f.deletions ?? 0), 0)

    return {
      number: pr.data.number,
      url: pr.data.html_url,
      branch: params.branch,
      title: params.title,
      body: params.body,
      filesChanged: files.length || params.files.length,
      additions,
      deletions,
    }
  }

  async commentPr(params: { repo: string; number: number; body: string }): Promise<void> {
    const [owner, repo] = params.repo.split('/')
    if (!owner || !repo) throw new Error(`GitHubLive: invalid repo "${params.repo}"`)
    const octokit = await this.octokit()
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: params.number,
      body: params.body,
    })
  }

  async isLive(): Promise<boolean> {
    try {
      const octokit = await this.octokit()
      await octokit.request('GET /installation/repositories', { per_page: 1 })
      return true
    } catch {
      return false
    }
  }
}

function normalizeKey(key: string): string {
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
}
