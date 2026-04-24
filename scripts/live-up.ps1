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
  $customers = Start-Process -PassThru -WindowStyle Hidden -FilePath pnpm -ArgumentList '--filter','@branch/subgraph-customers','start'
  $orders    = Start-Process -PassThru -WindowStyle Hidden -FilePath pnpm -ArgumentList '--filter','@branch/subgraph-orders','start'
  $catalog   = Start-Process -PassThru -WindowStyle Hidden -FilePath pnpm -ArgumentList '--filter','@branch/subgraph-catalog','start'
  $pids = @($customers.Id, $orders.Id, $catalog.Id)
  $pids | Set-Content -Path (Join-Path $root '.live-pids')

  Write-Host "[live] router http://localhost:3002/graphql" -ForegroundColor Green
  Write-Host "[live] starting web dashboard with ROUTER_URL wired" -ForegroundColor Cyan
  $env:ROUTER_URL = 'http://localhost:3002/graphql'
  pnpm --filter @branch/web dev
} finally {
  Pop-Location
}
