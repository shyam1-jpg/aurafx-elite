@echo off
title AuraFX Elite - Test
echo.
echo ========================================
echo   AuraFX Elite - Quick Test
echo ========================================
echo.

cd /d "%~dp0news-risk-server"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org
  echo.
  echo You can still test MT5 - see TEST-GUIDE.txt
  pause
  exit /b 1
)

echo [1] Starting test API server on http://127.0.0.1:3847
echo     Keep this window OPEN while testing dashboards.
echo.
start "AuraFX API" cmd /k node test-server.js

timeout /t 2 /nobreak >nul

echo [2] Opening Pro Dashboard in browser...
start "" "%~dp0pro-dashboard\index.html"

timeout /t 1 /nobreak >nul

echo [3] Opening Risk Dashboard in browser...
start "" "%~dp0risk-dashboard\index.html"

echo.
echo ========================================
echo   What to check in the browser:
echo   - Bullish/Bearish %% bars move
echo   - Checklist shows pass/fail
echo   - Session name shows (London etc.)
echo   - Server status not Offline
echo ========================================
echo.
echo MT5 test: read TEST-GUIDE.txt in this folder
echo.
pause
