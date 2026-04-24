import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// Thin wrapper around `apko build` so we can call it from the executor agent.
// Runs apko inside a container when not installed locally.
async function run(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((ok, fail) => {
    const p = spawn(cmd, args, { stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))))
  })
}

async function main() {
  const tag = process.argv[2]
  if (!tag) {
    console.error('usage: build <tag>')
    process.exit(1)
  }
  const here = resolve(new URL('..', import.meta.url).pathname)
  await run('docker', [
    'run',
    '--rm',
    '-v',
    `${here}:/work`,
    '-w',
    '/work',
    'cgr.dev/chainguard/apko:latest',
    'build',
    'apko.yaml',
    `branch/preview:${tag}`,
    'preview.tar',
  ])
  console.log(`preview image built: branch/preview:${tag}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
