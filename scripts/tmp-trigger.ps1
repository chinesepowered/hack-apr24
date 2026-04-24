$resp = Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/runs -Headers @{'content-type'='application/json'} -Body '{}'
Write-Output $resp.runId
