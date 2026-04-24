#Requires -Version 5
# Compose the Cosmo supergraph.json from the three subgraphs.
# 1. Exports each subgraph's federated SDL via `start --print-schema` into
#    services/cosmo-router/schemas/*.graphql
# 2. Runs `npx wgc router compose` against services/cosmo-router/supergraph.yaml
#
# No Cosmo Cloud credentials required; this is the local composition path.

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$schemasDir = Join-Path $root 'services/cosmo-router/schemas'
New-Item -ItemType Directory -Force -Path $schemasDir | Out-Null

$subgraphs = @(
  @{ name = 'customers'; pkg = '@branch/subgraph-customers' },
  @{ name = 'orders';    pkg = '@branch/subgraph-orders' },
  @{ name = 'catalog';   pkg = '@branch/subgraph-catalog' }
)

foreach ($sg in $subgraphs) {
  $out = Join-Path $schemasDir "$($sg.name).graphql"
  Write-Host "[compose] exporting $($sg.name) -> $out"
  $env:SCHEMA_OUT = $out
  pnpm --filter $sg.pkg exec tsx src/index.ts --print-schema
  if ($LASTEXITCODE -ne 0) { throw "schema export failed for $($sg.name)" }
}
Remove-Item Env:SCHEMA_OUT -ErrorAction SilentlyContinue

Push-Location (Join-Path $root 'services/cosmo-router')
try {
  Write-Host "[compose] running wgc router compose"
  npx --yes -p wgc@latest wgc router compose --input supergraph.yaml --out supergraph.json
  if ($LASTEXITCODE -ne 0) { throw "wgc compose failed" }
  Write-Host "[compose] wrote supergraph.json"
} finally {
  Pop-Location
}
