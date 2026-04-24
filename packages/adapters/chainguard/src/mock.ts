import type { BuildResult, ChainguardAdapter } from './types.ts'

export class ChainguardMock implements ChainguardAdapter {
  async buildPreviewImage(params: {
    apkoConfigPath: string
    tag: string
  }): Promise<BuildResult> {
    const digest = `sha256:${'a'.repeat(8)}${randomHex(8)}${'e'.repeat(8)}${randomHex(40)}`
    return {
      ref: `cgr.dev/branch/preview:${params.tag}`,
      digest,
      sizeBytes: 38_421_504,
      cveCount: 0,
    }
  }

  async cveDelta(
    _vanillaRef: string,
    _chainguardRef: string,
    _chainguardArchivePath?: string,
  ): Promise<{ vanilla: number; chainguard: number; delta: number }> {
    return { vanilla: 47, chainguard: 0, delta: -47 }
  }

  async isLive(): Promise<boolean> {
    return false
  }
}

function randomHex(n: number): string {
  const alphabet = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * 16)]
  return out
}
