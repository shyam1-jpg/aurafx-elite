@echo off
title AuraFX Server
cd /d "%~dp0website"

echo.
echo ========================================
echo   AuraFX - Starting Local Website
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is NOT installed.
  echo.
  echo 1. Go to https://nodejs.org
  echo 2. Download LTS version
  echo 3. Install with default options
  echo 4. Restart PC
  echo 5. Run this file again
  echo.
  pause
  exit /b 1
)

echo Node found. Starting server (no npm needed)...
echo.
echo KEEP THIS WINDOW OPEN while using the website.
echo.
echo CLOSE any old browser tab that says "Wiring" or "live-wiring".
echo Use only: http://127.0.0.1:3847/dashboard.html
echo.

start "" "http://127.0.0.1:3847/aura-lite.html"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:3847/dashboard.html"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:3847/"

node simple-server.js

echo.
echo Server stopped. Press any key to close.
pause
