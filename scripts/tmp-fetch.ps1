param([string]$RunId)
$url = "http://localhost:3000/api/runs/$RunId/events"
try {
  $r = Invoke-WebRequest -Uri $url -TimeoutSec 8 -UseBasicParsing
  $r.Content
} catch {
  Write-Output "fetch error: $($_.Exception.Message)"
}
