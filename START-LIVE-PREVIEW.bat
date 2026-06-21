@echo off

title AuraFX Server — LIVE PREVIEW (owner only)

cd /d "%~dp0website"



echo.

echo ========================================

echo   AuraFX — OWNER LIVE PREVIEW MODE

echo ========================================

echo.

echo Public site stays on DEMO institutional data.

echo Only YOU (owner key) see live FX/crypto on dashboard.

echo.

echo Open: http://127.0.0.1:3847/owner-preview.html

echo.



where node >nul 2>&1

if errorlevel 1 (

  echo [ERROR] Node.js not installed — https://nodejs.org

  pause

  exit /b 1

)



set INSTITUTIONAL_MODE=preview

if not defined AURAFX_OWNER_KEY set AURAFX_OWNER_KEY=aurafx-owner



start "" "http://127.0.0.1:3847/owner-preview.html"

timeout /t 1 /nobreak >nul



node simple-server.js



pause

