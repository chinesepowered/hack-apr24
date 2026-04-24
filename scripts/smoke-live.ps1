$ErrorActionPreference = 'Stop'
$post = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Method Post -Uri 'http://localhost:3000/api/runs' -Body '{"speed":6}' -ContentType 'application/json'
$runId = ($post.Content | ConvertFrom-Json).runId
Write-Host "runId = $runId"

Start-Sleep -Seconds 3
$req = [System.Net.HttpWebRequest]::Create("http://localhost:3000/api/runs/$runId/events")
$req.Method = 'GET'
$req.Timeout = 20000
$req.ReadWriteTimeout = 4000
$resp = $req.GetResponse()
$reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
$buf = New-Object System.Text.StringBuilder
$deadline = (Get-Date).AddSeconds(8)
while ((Get-Date) -lt $deadline) {
  try { $l = $reader.ReadLine(); if ($l -ne $null) { [void]$buf.AppendLine($l) } } catch { break }
}
foreach ($line in ($buf.ToString() -split "`n")) {
  if ($line -like 'data: *') {
    $obj = $line.Substring(6) | ConvertFrom-Json
    if ($obj.kind -eq 'verification_result') {
      Write-Host "--- verification_result ---"
      Write-Host ("ok     = " + $obj.ok)
      Write-Host ("query  = " + $obj.query)
      Write-Host ("after  = " + ($obj.after | ConvertTo-Json -Depth 8 -Compress))
    }
  }
}
