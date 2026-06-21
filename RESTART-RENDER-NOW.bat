@echo off
title AuraFX — RESTART Render deploy
color 0E
cd /d "%~dp0"

echo.
echo ============================================================
echo   AURAFX — RESTART RENDER (3 steps in YOUR browser)
echo ============================================================
echo.
echo I pushed fixes to GitHub. You only need to click in Render.
echo Use Chrome or Edge — NOT the small Cursor browser panel.
echo.

where gh >nul 2>&1
if not errorlevel 1 (
  echo Pushing latest code to GitHub...
  git add -A
  git commit -m "Fix Render deploy: resilient startup + root package.json" 2>nul
  git push origin main 2>nul
  if errorlevel 1 echo Note: push skipped — run SHOW-GITHUB-CODE.bat if needed.
  echo.
)

echo STEP 1 — Opening Render dashboard...
start "" "https://dashboard.render.com/web/srv-aurafx-elite"
timeout /t 2 /nobreak >nul
start "" "https://dashboard.render.com"
echo.
echo   If you see your service  aurafx-elite:
echo     - Click it
echo     - Settings: Root Directory = website  (or leave blank — both work now)
echo     - Build Command = npm install
echo     - Start Command = npm start
echo     - Click  Save Changes
echo     - Top right: Manual Deploy -^> Deploy latest commit
echo     - Wait until badge says LIVE (green)
echo.
echo   OR delete the broken service and use Blueprint (easier):
start "" "https://dashboard.render.com/select-repo?type=blueprint"
echo     - Pick repo: shyam1-jpg / aurafx-elite
echo     - Click Apply (uses render.yaml automatically)
echo.

echo STEP 2 — After LIVE, add custom domain in Render Settings:
echo     aurafxelite.com
echo     www.aurafxelite.com
echo.

echo STEP 3 — GoDaddy DNS (opens now)...
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
echo     A      @    216.24.57.1
echo     CNAME  www  aurafx-elite.onrender.com
echo     SAVE ALL
echo.

echo TEST when done: https://aurafx-elite.onrender.com
echo Reply LIVE in Cursor chat — I will verify the site for you.
echo.
pause
