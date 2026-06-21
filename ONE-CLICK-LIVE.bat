@echo off
title AuraFX — ONE CLICK LIVE (run after GitHub code)
cd /d "%~dp0"
echo.
echo ============================================================
echo   AURAFX — automatic push + open Render + GoDaddy
echo ============================================================
echo.
where gh >nul 2>&1 || (echo Install GitHub CLI: https://cli.github.com && pause && exit /b 1)
gh auth status >nul 2>&1
if errorlevel 1 (
  echo STEP A: GitHub not connected yet.
  echo.
  echo 1. Browser opens https://github.com/login/device
  echo 2. Run this in a NEW terminal first:
  echo      gh auth login -h github.com -p https -w
  echo 3. Enter the 8-character code shown in terminal
  echo 4. Run this bat again
  echo.
  start "" "https://github.com/login/device"
  gh auth login -h github.com -p https -w
)
gh auth status >nul 2>&1 || (echo GitHub login failed. Try again. && pause && exit /b 1)
echo [OK] GitHub connected.
git branch -M main 2>nul
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Pushing new repo aurafx-elite to GitHub...
  gh repo create aurafx-elite --private --source=. --remote=origin --push
) else (
  git add -A
  git commit -m "AuraFX live update" 2>nul
  git push -u origin main
)
if errorlevel 1 (echo Push failed. && pause && exit /b 1)
echo [OK] Code on GitHub.
echo.
echo NEXT in browser (opening now):
echo   Render: New + ^> Blueprint ^> aurafx-elite ^> Apply
echo   GoDaddy: A @ 216.24.57.1  and  CNAME www aurafx-elite.onrender.com
start "" "https://dashboard.render.com/select-repo?type=blueprint"
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
notepad "%~dp0MAKE-LIVE-NOW.txt"
echo.
echo When Render is LIVE, test: https://aurafx-elite.onrender.com
pause
