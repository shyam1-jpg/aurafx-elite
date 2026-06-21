$ErrorActionPreference = 'Continue'
$me = 'C:\Program Files\MetaTrader 5\metaeditor64.exe'
$mt5 = 'C:\Users\shyam prasad\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5'
$files = @(
  "$mt5\Indicators\AuraFX_Elite_Signals.mq5",
  "$mt5\Indicators\AuraFX_Risk_Guardian.mq5",
  "$mt5\Indicators\AuraFX_Pro_Assistant.mq5",
  "$mt5\Experts\AuraFX_Elite_EA.mq5",
  "$mt5\Experts\AuraFX_Pro_EA.mq5"
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) { Write-Host "MISSING $f"; continue }
  $log = [IO.Path]::ChangeExtension($f, '.log')
  if (Test-Path $log) { Remove-Item $log -Force }
  $proc = Start-Process -FilePath $me -ArgumentList "/compile:`"$f`"","/log" -PassThru -Wait
  Start-Sleep -Seconds 2
  $ex5 = $f -replace '\.mq5$','.ex5'
  Write-Host "$([IO.Path]::GetFileName($f)) exit=$($proc.ExitCode) ex5=$(Test-Path $ex5)"
  if (Test-Path $log) { Get-Content $log -Tail 15 }
}
