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

    // Retain the OCI tarball for grype (oci-archive:) — caller cleans up via cveDelta.
    return {
      ref: loadedRef,
      digest: digest || `sha256:${'0'.repeat(64)}`,
      sizeBytes: Number(sizeStr) || 0,
      cveCount: 0,
      archivePath: tarPath,
    }
  }

  async cveDelta(
    vanillaRef: string,
    chainguardRef: string,
    chainguardArchivePath?: string,
  ): Promise<{ vanilla: number; chainguard: number; delta: number }> {
    // Vanilla: scan via `registry:` so grype pulls directly over HTTPS — no
    // dependency on the host docker socket (which isn't available inside the
    // grype container on Windows Docker Desktop). Chainguard: scan the OCI
    // tarball that apko produced; that file is mounted into the container so
    // again no daemon is needed.
    const vanilla = await grypeRegistry(vanillaRef)
    const chainguard = chainguardArchivePath
      ? await grypeOciArchive(chainguardArchivePath)
      : await grypeRegistry(chainguardRef)
    if (chainguardArchivePath) {
      await fs.rm(path.dirname(chainguardArchivePath), { recursive: true, force: true })
        .catch(() => undefined)
    }
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

async function grypeRegistry(ref: string): Promise<number> {
  return grypeRun(['run', '--rm', GRYPE_IMAGE, `registry:${ref}`, '-o', 'json', '--quiet'], ref)
}

async function grypeOciArchive(archivePath: string): Promise<number> {
  // Mount the parent dir read-only so grype can resolve the OCI tarball.
  const dir = path.dirname(archivePath)
  const file = path.basename(archivePath)
  return grypeRun(
    [
      'run', '--rm',
      '-v', `${dir}:/scan:ro`,
      GRYPE_IMAGE,
      `oci-archive:/scan/${file}`,
      '-o', 'json', '--quiet',
    ],
    archivePath,
  )
}

async function grypeRun(args: string[], label: string): Promise<number> {
  try {
    const out = await runDocker(args)
    const report = JSON.parse(out) as { matches?: unknown[] }
    return report.matches?.length ?? 0
  } catch (err) {
    process.stderr.write(`[chainguard] grype scan of ${label} failed: ${
      err instanceof Error ? err.message : String(err)
    }\n`)
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
