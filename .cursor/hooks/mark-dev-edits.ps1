# Marks that source files were edited — enables test reminder on agent stop.
$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
$marker = Join-Path $PSScriptRoot '.dev-pending-test'

$codePattern = '\.(mq5|mqh|mq4|mqh|js|jsx|ts|tsx|py|html|css|json)\b'
if ($raw -match $codePattern) {
    (Get-Date).ToString('o') | Set-Content -Path $marker -Encoding UTF8
}

Write-Output '{}'
exit 0
