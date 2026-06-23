@echo off
title AuraFX — Auto trading on DEMO
cd /d "%~dp0"

echo.
echo ========================================
echo   AuraFX AUTO TRADING (DEMO ONLY)
echo ========================================
echo.
echo Installing latest EA into MetaTrader 5...
call "%~dp0INSTALL-MT5-AURAFX.bat" /silent

echo Compiling AuraFX_Elite_EA...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$me='C:\Program Files\MetaTrader 5\metaeditor64.exe';" ^
  "$f='$env:APPDATA\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Experts\AuraFX_Elite_EA.mq5';" ^
  "if(Test-Path $f){ Start-Process $me -ArgumentList \"/compile:`\"$f`\"\",\"/log\" -Wait }"

echo.
echo ========================================
echo   NOW IN METATRADER 5 (demo account):
echo ========================================
echo.
echo  1. Chart: EURUSD, timeframe H1
echo  2. REMOVE the Signals indicator if attached
echo  3. Navigator - Expert Advisors - AuraFX_Elite_EA
echo  4. Drag EA onto chart - click OK
echo  5. Turn ON "Algo Trading" (green button, top toolbar)
echo  6. Smile icon on chart must show (not X)
echo.
echo WHAT THE EA DOES:
echo  - Opens BUY/SELL automatically on signals
echo  - Stop loss = limits your risk
echo  - Take profit = closes when in profit
echo  - Trailing stop = locks profit as price moves
echo  - Breakeven = moves stop to safe after profit
echo  - Stops new trades if daily loss hits 3%%
echo.
echo DEMO ONLY - not real money!
echo.
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
pause
