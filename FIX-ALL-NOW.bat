@echo off
title FIX ALL — AuraFX aurafxelite.com
color 0A
cd /d "%~dp0"
cls
echo.
echo  ============================================================
echo    FIX ALL — GitHub + Render + DNS for aurafxelite.com
echo  ============================================================
echo.
echo  Problem 1: aurafxelite.com = no DNS (ERR_NAME_NOT_RESOLVED)
echo  Problem 2: Render = 404 (website not deployed)
echo.
echo  This window will guide you. Do NOT close it.
echo.
pause

where gh >nul 2>&1
if errorlevel 1 (
  echo [INSTALL] GitHub CLI required.
  start "" "https://cli.github.com/"
  pause
  exit /b 1
)

:GITHUB
echo.
echo  ========== STEP 1 of 3: GITHUB ==========
gh auth status >nul 2>&1
if not errorlevel 1 goto PUSH
echo  Browser will open. Copy the 8-character code from THIS window.
echo  Paste it at github.com/login/device then click Authorize.
echo.
start "" "https://github.com/login/device"
gh auth login -h github.com -p https -w
gh auth status >nul 2>&1
if errorlevel 1 (
  echo  GitHub login failed. Try again.
  goto GITHUB
)
echo  [OK] GitHub connected.

:PUSH
echo.
echo  ========== STEP 2 of 3: PUSH CODE ==========
git branch -M main 2>nul
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  gh repo create aurafx-elite --private --source=. --remote=origin --push
) else (
  git add -A
  git commit -m "AuraFX deploy update" 2>nul
  git push -u origin main
)
if errorlevel 1 (
  echo  Push failed. Check internet.
  pause
  exit /b 1
)
echo  [OK] Code on GitHub.

:RENDER
echo.
echo  ========== STEP 3 of 3: RENDER + GODADDY ==========
echo  In the browser tabs that open:
echo.
echo  RENDER:
echo    1. Sign in with GitHub
echo    2. New + -^> Blueprint -^> aurafx-elite -^> Apply
echo    3. Wait until LIVE (green)
echo    4. Settings -^> Custom Domains -^> add aurafxelite.com + www
echo.
echo  GODADDY (after Render is Live):
echo    A record  @  =  216.24.57.1
echo    CNAME  www  =  aurafx-elite.onrender.com
echo    Click SAVE ALL
echo.
start "" "https://dashboard.render.com/select-repo?type=blueprint"
timeout /t 2 /nobreak >nul
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
notepad "%~dp0SETUP-ALL.txt"
echo.
echo  When Render shows LIVE, test: https://aurafx-elite.onrender.com
echo  After DNS (15-60 min): https://aurafxelite.com
echo.
pause
