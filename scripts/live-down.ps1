#Requires -Version 5
# Tear down the live Branch stack started by scripts/live-up.ps1.

$ErrorActionPreference = 'SilentlyContinue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$pidFile = Join-Path $root '.live-pids'
if (Test-Path $pidFile) {
  Get-Content $pidFile | ForEach-Object {
    if ($_ -match '^\d+$') {
      Stop-Process -Id [int]$_ -Force -ErrorAction SilentlyContinue
    }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Fallback: kill anything bound to subgraph ports.
foreach ($port in 4001,4002,4003) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Push-Location $root
try {
  docker compose stop cosmo-router nats postgres | Out-Null
} finally {
  Pop-Location
}
Write-Host "[live] stopped" -ForegroundColor Yellow
