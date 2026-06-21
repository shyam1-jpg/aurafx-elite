@echo off
title AuraFX Elite — FULL LIVE SETUP
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   AURAFX ELITE — FULL LIVE SETUP (GitHub + Render + DNS)
echo ============================================================
echo.

where node >nul 2>&1 || (echo Install Node.js from https://nodejs.org && pause && exit /b 1)
where gh >nul 2>&1 || (
  echo GitHub CLI not found. Install from https://cli.github.com
  start "" "https://cli.github.com/"
  pause
  exit /b 1
)

echo [1/5] GitHub login...
gh auth status >nul 2>&1
if errorlevel 1 (
  echo   A browser window will open — sign into GitHub, then return here.
  gh auth login -h github.com -p https -w
)
gh auth status >nul 2>&1
if errorlevel 1 (
  echo [STOP] GitHub login failed. Run: gh auth login
  pause
  exit /b 1
)
echo   OK — GitHub connected.

echo.
echo [2/5] Push code to GitHub...
git branch -M main 2>nul
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo   Creating private repo aurafx-elite...
  gh repo create aurafx-elite --private --source=. --remote=origin --push
) else (
  git add -A
  git commit -m "AuraFX live deploy update" 2>nul
  git push -u origin main
)
if errorlevel 1 (
  echo [STOP] Push failed. Check internet and gh auth.
  pause
  exit /b 1
)
echo   OK — code on GitHub.

echo.
echo [3/5] Open Render Blueprint...
echo   In Render: New + ^> Blueprint ^> select aurafx-elite ^> Apply
start "" "https://dashboard.render.com/select-repo?type=blueprint"
timeout /t 2 /nobreak >nul

echo.
echo [4/5] When Render shows LIVE, add custom domains:
echo   aurafxelite.com  and  www.aurafxelite.com
start "" "https://dashboard.render.com/"

echo.
echo [5/5] GoDaddy DNS (after Render is Live)...
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
echo   A record @ = 216.24.57.1
echo   CNAME www = aurafx-elite.onrender.com
echo.
notepad "%~dp0MAKE-LIVE-NOW.txt"

echo.
echo ============================================================
echo   DONE on this PC. Finish Render + GoDaddy in the browser.
echo   Test: https://aurafx-elite.onrender.com
echo         https://aurafxelite.com (after DNS, 15-60 min)
echo ============================================================
pause
