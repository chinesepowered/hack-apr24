import type { BuildResult, ChainguardAdapter } from './types.ts'

/**
 * Shells out to `apko build` (preferably inside a Chainguard builder image)
 * and optionally `grype` / `chainctl` for CVE diffs. Wired up during
 * services/preview-builder implementation.
 */
export class ChainguardLive implements ChainguardAdapter {
  constructor(
    private readonly opts: {
      pullTokenUsername?: string
      pullTokenPassword?: string
    } = {},
  ) {}

  async buildPreviewImage(_params: {
    apkoConfigPath: string
    tag: string
  }): Promise<BuildResult> {
    throw new Error('ChainguardLive.buildPreviewImage not implemented yet')
  }

  async cveDelta(
    _vanillaRef: string,
    _chainguardRef: string,
  ): Promise<{ vanilla: number; chainguard: number; delta: number }> {
    throw new Error('ChainguardLive.cveDelta not implemented yet')
  }

  async isLive(): Promise<boolean> {
    return Boolean(this.opts.pullTokenUsername && this.opts.pullTokenPassword)
  }
}
