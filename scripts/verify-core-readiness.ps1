$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$failures = @()

function Require-Match($path, $pattern, $label) {
  $text = Get-Content -LiteralPath $path -Raw
  if ($text -notmatch $pattern) { $script:failures += $label }
}

Require-Match "$root\MQL5\Experts\AuraFX_Elite_EA.mq5" 'InpEnableOrderExecution\s*=\s*false' 'MT5 safe execution default missing'
Require-Match "$root\MQL4\Experts\AuraFX_Elite_EA.mq4" 'InpEnableOrderExecution\s*=\s*false' 'MT4 safe execution default missing'
Require-Match "$root\website\simple-server.js" '/api/ai/status' 'AI status route missing'
Require-Match "$root\website\simple-server.js" '/api/ai/analyze' 'AI analysis route missing'
Require-Match "$root\website\ai-intelligence-service.js" "decision:\s*'NO_TRADE'" 'AI fail-closed decision missing'
Require-Match "$root\website\ai-intelligence-service.js" 'execution_eligible:\s*false' 'AI execution boundary missing'

$trackedSecrets = git -C $root grep -n -I -E 'sk-(proj-)?[A-Za-z0-9_-]{20,}' -- . 2>$null
if ($LASTEXITCODE -eq 0 -and $trackedSecrets) { $failures += 'Possible tracked OpenAI secret detected' }

node --check "$root\website\simple-server.js"
node --check "$root\website\ai-intelligence-service.js"
node --check "$root\website\public\js\advanced-market-chart.js"
npm --prefix "$root\website" run test:ai

if ($failures.Count) {
  $failures | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
  exit 1
}

Write-Host 'PASS: AuraFX core readiness checks passed.' -ForegroundColor Green
Write-Host 'NOTE: MetaEditor compilation and demo backtesting are still required before enabling execution.'
