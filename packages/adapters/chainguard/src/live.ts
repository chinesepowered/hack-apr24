import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { BuildResult, ChainguardAdapter } from './types.ts'

const APKO_IMAGE = 'cgr.dev/chainguard/apko:latest'
const GRYPE_IMAGE = 'cgr.dev/chainguard/grype:latest'

// Builds a preview image by shelling out to the Chainguard `apko` container
// (no local install needed) and loading the resulting OCI tarball into the
// host Docker daemon. CVE delta uses the Chainguard `grype` container.
export class ChainguardLive implements ChainguardAdapter {
  constructor(
    private readonly opts: {
      pullTokenUsername?: string
      pullTokenPassword?: string
      workspaceRoot?: string
    } = {},
  ) {}

  async buildPreviewImage(params: {
    apkoConfigPath: string
    tag: string
  }): Promise<BuildResult> {
    const workspaceRoot = this.opts.workspaceRoot ?? process.cwd()
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-apko-'))
    const tarPath = path.join(outDir, 'preview.tar')
    const ref = `branch/preview:${params.tag}`

    // apko build inside the official Chainguard apko container.
    await runDocker([
      'run', '--rm',
      '-v', `${workspaceRoot}:/work`,
      '-v', `${outDir}:/out`,
      '-w', '/work',
      APKO_IMAGE,
      'build', params.apkoConfigPath, ref, '/out/preview.tar',
    ])

    // Load the OCI tarball into the host daemon so we can inspect it.
    const loadOut = await runDocker(['load', '-i', tarPath])
    // Parse "Loaded image: <ref>" or digest lines.
    const loadedRef = (/Loaded image[^:]*:\s*(\S+)/i.exec(loadOut)?.[1]) ?? ref

    const inspect = await runDocker(['inspect', '--format', '{{.Id}}|{{.Size}}', loadedRef])
    const [digest, sizeStr] = inspect.trim().split('|')

    await fs.rm(outDir, { recursive: true, force: true })

    return {
      ref: loadedRef,
      digest: digest || `sha256:${'0'.repeat(64)}`,
      sizeBytes: Number(sizeStr) || 0,
      cveCount: 0,
    }
  }

  async cveDelta(
    vanillaRef: string,
    chainguardRef: string,
  ): Promise<{ vanilla: number; chainguard: number; delta: number }> {
    const [vanilla, chainguard] = await Promise.all([
      grypeCount(vanillaRef),
      grypeCount(chainguardRef),
    ])
    return { vanilla, chainguard, delta: chainguard - vanilla }
  }

  async isLive(): Promise<boolean> {
    try {
      await runDocker(['version', '--format', '{{.Server.Version}}'])
      return true
    } catch {
      return false
    }
  }
}

async function grypeCount(ref: string): Promise<number> {
  const out = await runDocker([
    'run', '--rm',
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    GRYPE_IMAGE,
    ref, '-o', 'json', '--quiet',
  ])
  try {
    const report = JSON.parse(out) as { matches?: unknown[] }
    return report.matches?.length ?? 0
  } catch {
    return 0
  }
}

function runDocker(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`docker ${args.join(' ')} exited ${code}: ${stderr || stdout}`))
    })
  })
}
