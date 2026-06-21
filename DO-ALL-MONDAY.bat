@echo off
title AuraFX Elite — Do all (website + MT5 + open guides)
cd /d "%~dp0"

echo [1/4] Starting live website...
start "AuraFX Website" cmd /k "cd /d \"%~dp0website\" && node simple-server.js"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:3847/"
start "" "http://127.0.0.1:3847/hard-sell.html"
start "" "http://127.0.0.1:3847/system-status.html"

echo [2/4] Installing AuraFX into MetaTrader 5...
call "%~dp0INSTALL-MT5-AURAFX.bat" /silent

echo [3/4] Compiling .ex5 for MQL5 Market upload...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\compile-mt5.ps1"

echo [4/4] Opening MQL5 seller guide...
start "" "https://www.mql5.com/en/users/shyam108/seller"
notepad "%~dp0MQL5-FILL-FORM.txt"

echo.
echo DONE. Log into MQL5 in YOUR browser and paste from MQL5-FILL-FORM.txt
echo MT5: open terminal, XAUUSD H1, attach AuraFX_Elite_Signals from Navigator.
pause
