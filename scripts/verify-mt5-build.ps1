# AuraFX verify build
$ErrorActionPreference = 'Continue'
$mt5 = Get-ChildItem "$env:APPDATA\MetaQuotes\Terminal" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'MQL5' } | Where-Object { Test-Path (Join-Path $_ 'Experts') } | Select-Object -First 1
if (-not $mt5) { Write-Host 'FAIL: MT5 not found'; exit 1 }
$pass = 0; $fail = @()
Get-ChildItem $mt5\Experts,$mt5\Indicators,$mt5\Scripts -Filter 'AuraFX_*.mq5' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch ' - Copy' } | Sort-Object Name | ForEach-Object {
  $ex5 = $_.FullName -replace '\.mq5$','.ex5'
  $log = $_.FullName -replace '\.mq5$','.log'
  $errs = 1
  if (Test-Path $log) { $t = Get-Content $log -Tail 1; if ($t -match '(\d+) errors') { $errs = [int]$Matches[1] } }
  if ((Test-Path $ex5) -and $errs -eq 0) { Write-Host "OK   $($_.Name)"; $pass++ } else { Write-Host "FAIL $($_.Name)"; $fail += $_.Name }
}
Write-Host "TOTAL PASS: $pass FAIL: $($fail.Count)"
if ($fail.Count) { exit 1 }
exit 0
