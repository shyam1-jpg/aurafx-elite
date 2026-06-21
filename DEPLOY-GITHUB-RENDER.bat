@echo off
title AuraFX Elite — Push to GitHub + Render
cd /d "%~dp0"

echo.
echo ========================================
echo   Deploy aurafxelite.com on Render
echo ========================================
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo Install GitHub CLI: https://cli.github.com/
  start "" "https://cli.github.com/"
  pause
  exit /b 1
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo Log into GitHub first...
  gh auth login
)

if not exist ".git" (
  git init
  git branch -M main
)

git add -A
git status -sb
echo.
set /p MSG=Commit message [AuraFX Elite live site + MT5]: 
if "%MSG%"=="" set MSG=AuraFX Elite live site + MT5
git commit -m "%MSG%" 2>nul
if errorlevel 1 echo Note: nothing new to commit or commit skipped.

echo.
echo Create repo on GitHub (private OK) then:
echo   gh repo create aurafx-elite --private --source=. --remote=origin --push
echo.
echo Or if repo exists:
echo   git remote add origin https://github.com/YOUR_USER/aurafx-elite.git
echo   git push -u origin main
echo.
echo Then on https://dashboard.render.com:
echo   New ^> Blueprint ^> connect repo ^> uses render.yaml in this folder
echo   OR New Web Service: root=website, build=npm install, start=npm start
echo   Add custom domains: aurafxelite.com and www.aurafxelite.com
echo.
start "" "https://dashboard.render.com/blueprints"
start "" "https://github.com/new"
pause
