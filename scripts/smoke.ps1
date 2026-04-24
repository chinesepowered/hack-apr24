$ErrorActionPreference = 'Stop'
$home_resp = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri 'http://localhost:3000/'
Write-Host ("home.status = " + $home_resp.StatusCode)
Write-Host ("home.length = " + $home_resp.Content.Length)
Write-Host ("home.has_branch = " + ($home_resp.Content -match 'Branch'))
Write-Host ("home.has_run_demo = " + ($home_resp.Content -match 'Run demo'))

$post = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Method Post -Uri 'http://localhost:3000/api/runs' -Body '{"speed":4}' -ContentType 'application/json'
Write-Host ("post.status = " + $post.StatusCode)
Write-Host ("post.body = " + $post.Content)
$runId = ($post.Content | ConvertFrom-Json).runId
Write-Host ("runId = " + $runId)

Start-Sleep -Seconds 2

# Fetch events using a raw socket so we capture partial SSE output
$req = [System.Net.HttpWebRequest]::Create("http://localhost:3000/api/runs/$runId/events")
$req.Method = 'GET'
$req.Timeout = 15000
$req.ReadWriteTimeout = 3000
try {
  $resp = $req.GetResponse()
  $stream = $resp.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $buf = New-Object System.Text.StringBuilder
  $deadline = (Get-Date).AddSeconds(6)
  while ((Get-Date) -lt $deadline) {
    try {
      $line = $reader.ReadLine()
      if ($line -ne $null) { [void]$buf.AppendLine($line) }
    } catch { break }
  }
  $content = $buf.ToString()
  Write-Host ("events.length = " + $content.Length)
  $lines = $content -split "`n"
  $kinds = @()
  foreach ($l in $lines) {
    if ($l -like 'data: *') {
      $json = $l.Substring(6)
      try {
        $obj = $json | ConvertFrom-Json
        $kinds += $obj.kind
      } catch {}
    }
  }
  Write-Host ("events.kinds = " + ($kinds -join ', '))
} catch {
  Write-Host ("events.error = " + $_.Exception.Message)
}
