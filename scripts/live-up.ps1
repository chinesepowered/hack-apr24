#Requires -Version 5
# Boot the live Branch stack: Postgres, NATS, Cosmo router, three subgraphs,
# then the web dashboard with ROUTER_URL wired so the verify phase hits the
# real supergraph instead of returning canned data.
#
# Prereqs: Docker Desktop running; `pnpm install` already done.

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
  Write-Host "[live] starting Postgres, NATS, Cosmo router" -ForegroundColor Cyan
  docker compose up -d postgres nats cosmo-router | Out-Null

  Write-Host "[live] waiting for Postgres" -ForegroundColor Cyan
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    docker exec hack-apr24-postgres-1 pg_isready -U branch -d branch_prod 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
  }

  Write-Host "[live] migrating + seeding DB (idempotent)" -ForegroundColor Cyan
  pnpm --filter @branch/db migrate | Out-Null
  pnpm --filter @branch/db seed   | Out-Null

  Write-Host "[live] starting subgraphs on :4001 :4002 :4003" -ForegroundColor Cyan
  # On Windows pnpm ships as both pnpm.cmd and pnpm.ps1; Start-Process -FilePath
  # pnpm can resolve to the .ps1, which Windows then opens with the "How do you
  # want to open this file?" dialog. Going through cmd.exe sidesteps the
  # extension lookup entirely.
  function Start-Subgraph($filter) {
    Start-Process -PassThru -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList @('/c', 'pnpm', '--filter', $filter, 'start')
  }

  $customers = Start-Subgraph '@branch/subgraph-customers'
  $orders    = Start-Subgraph '@branch/subgraph-orders'
  $catalog   = Start-Subgraph '@branch/subgraph-catalog'
  $pids = @($customers.Id, $orders.Id, $catalog.Id)
  $pids | Set-Content -Path (Join-Path $root '.live-pids')

  Write-Host "[live] router http://localhost:3002/graphql  mcp http://localhost:5025/mcp" -ForegroundColor Green
  Write-Host "[live] starting web dashboard with ROUTER_URL + root .env wired" -ForegroundColor Cyan
  # Load monorepo root .env so OPENAI_* (GLM planner), Ghost and GitHub App
  # creds reach the web app. Handles double-quoted values with \n escapes
  # (e.g. GITHUB_APP_PRIVATE_KEY) by decoding them back to real newlines.
  $envFile = Join-Path $root '.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $name = $matches[1]
        $raw = $matches[2]
        if ($raw.StartsWith('"') -and $raw.EndsWith('"') -and $raw.Length -ge 2) {
          $value = $raw.Substring(1, $raw.Length - 2) -replace '\\n', "`n" -replace '\\r', "`r" -replace '\\t', "`t"
        } elseif ($raw.StartsWith("'") -and $raw.EndsWith("'") -and $raw.Length -ge 2) {
          $value = $raw.Substring(1, $raw.Length - 2)
        } else {
          $value = $raw
        }
        if ($value) { Set-Item -Path "Env:$name" -Value $value }
      }
    }
  }
  $env:ROUTER_URL = 'http://localhost:3002/graphql'
  # Chainguard adapter needs the monorepo root as its docker-volume mount so
  # apko can resolve services/preview-builder/apko.yaml. Without this it falls
  # back to process.cwd() (= apps/web) and the build fails with "file does not exist".
  $env:BRANCH_WORKSPACE_ROOT = $root.Path
  pnpm --filter @branch/web dev
} finally {
  Pop-Location
}
