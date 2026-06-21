# After development stops, prompt AuraFX / MT5 testing (fail-open).
$ErrorActionPreference = 'SilentlyContinue'
$null = [Console]::In.ReadToEnd()

$marker = Join-Path $PSScriptRoot '.dev-pending-test'
if (-not (Test-Path $marker)) {
    Write-Output '{}'
    exit 0
}

Remove-Item $marker -Force -ErrorAction SilentlyContinue

$msg = @'
Development edits detected. Run post-dev testing before release:

1. MetaEditor (F7): compile AuraFX_Elite_Signals.mq5 and AuraFX_Elite_EA.mq5 — expect 0 errors
2. MT5 Strategy Tester: demo backtest XAUUSD H1 and EURUSD H1
3. Demo chart: attach indicator; confirm BUY / SELL / COVER arrows and HUD panel
4. Browser: open AuraFX-Elite/preview/index.html for UI check

Proceed with this testing checklist now.
'@

@{ followup_message = $msg.Trim() } | ConvertTo-Json -Compress
exit 0
