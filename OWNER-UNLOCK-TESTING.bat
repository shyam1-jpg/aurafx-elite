@echo off
title Aura Elite FX — Owner testing unlock
cd /d "%~dp0"
echo.
echo ========================================
echo   OWNER TESTING UNLOCK
echo ========================================
echo.
echo 1. Open Render.com - aurafx-elite service
echo 2. Environment - copy AURAFX_OWNER_KEY value
echo 3. Browser opens - paste key on unlock page
echo.
start "" "https://aurafxelite.com/private-testing.html?next=/dashboard.html"
echo.
echo MT5 apps are NOT on the website for download.
echo You install from your PC only:
echo   %~dp0START-AUTO-TRADING-DEMO.bat
echo.
pause
