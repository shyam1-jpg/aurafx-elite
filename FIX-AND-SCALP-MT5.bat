@echo off
title AuraFX — FIX smiley face + M1 Hyper Scalper
cd /d "%~dp0"
echo.
echo ========================================
echo   FIX: No smiley = NO TRADES
echo   Install M1 Hyper Scalper
echo ========================================
echo.

call "%~dp0INSTALL-MT5-AURAFX.bat" /silent

set "MT5=%APPDATA%\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5"
set "ME=C:\Program Files\MetaTrader 5\metaeditor64.exe"

for %%F in (
  "Experts\AuraFX_M1_Hyper_Scalper_EA.mq5"
  "Scripts\AuraFX_Check_Algo.mq5"
) do (
  if exist "%MT5%\%%~F" (
    start /wait "" "%ME%" /compile:"%MT5%\%%~F" /log
    echo Compiled %%~F
  )
)

start "" notepad "%~dp0FIX-SMILEY-ALGO-TRADING.txt"
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"

echo.
echo IN MT5 NOW:
echo   1. Run script AuraFX_Check_Algo on any chart
echo   2. Fix until it says READY
echo   3. Open XAUUSD M1 chart
echo   4. Drag AuraFX_M1_Hyper_Scalper_EA onto M1 chart
echo   5. Smiley face must appear on chart corner
echo.
pause
