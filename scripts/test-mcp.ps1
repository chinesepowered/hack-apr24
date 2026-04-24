$ErrorActionPreference = 'Stop'
$headers = @{ 'Accept' = 'application/json, text/event-stream' }

$listBody = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
$r = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:5025/mcp -Method POST -ContentType 'application/json' -Headers $headers -Body $listBody
$names = [regex]::Matches($r.Content, '"name":"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
Write-Host ("tools: " + ($names -join ', '))

$callBody = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"execute_operation_list_customers","arguments":{}}}'
$r2 = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:5025/mcp -Method POST -ContentType 'application/json' -Headers $headers -Body $callBody
$snippet = $r2.Content.Substring(0, [Math]::Min(500, $r2.Content.Length))
Write-Host ("call status: " + $r2.StatusCode)
Write-Host ("snippet: " + $snippet)
