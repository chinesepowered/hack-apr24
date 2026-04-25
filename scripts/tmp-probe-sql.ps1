$ErrorActionPreference = 'Stop'
$queries = @(
  "SELECT pr_number, (embedding IS NULL) AS is_null, octet_length(embedding::text) AS embed_len FROM branch_pr_history WHERE repo='seed/branch-examples' LIMIT 3",
  "SELECT pr_number, title, score FROM branch_match_pr_history((SELECT embedding FROM branch_pr_history WHERE repo='seed/branch-examples' LIMIT 1)::vector, 3)",
  "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='branch_pr_history'",
  "SELECT proname, pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS result FROM pg_proc WHERE proname='branch_match_pr_history'"
)
foreach ($q in $queries) {
  Write-Host "=== $($q.Substring(0, [Math]::Min(80, $q.Length)))..." -ForegroundColor Cyan
  npx --yes @insforge/cli db query $q
  Write-Host ""
}
