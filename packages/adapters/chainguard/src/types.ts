export interface BuildResult {
  ref: string
  digest: string
  sizeBytes: number
  cveCount: number
  /** Path to the OCI tarball produced by apko, retained for CVE scanning. */
  archivePath?: string
}

export interface ChainguardAdapter {
  /** Build a preview image from an apko config YAML. Returns the ref + digest. */
  buildPreviewImage(params: {
    apkoConfigPath: string
    tag: string
  }): Promise<BuildResult>
  /** Compare CVE counts between a vanilla base image and our Chainguard build for the writeup. */
  cveDelta(
    vanillaRef: string,
    chainguardRef: string,
    chainguardArchivePath?: string,
  ): Promise<{
    vanilla: number
    chainguard: number
    delta: number
  }>
  isLive(): Promise<boolean>
}
