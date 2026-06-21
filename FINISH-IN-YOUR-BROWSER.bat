@echo off
title FINISH — use YOUR Chrome/Edge (not Cursor side panel)
color 0B
echo.
echo ============================================================
echo   IMPORTANT: Use the browser window that opens NOW
echo   (Chrome or Edge — NOT the Cursor side panel)
echo ============================================================
echo.
echo Your GitHub is connected on this PC as: shyam1-jpg
echo Your code is at: github.com/shyam1-jpg/aurafx-elite
echo.
echo Opening Render in your normal browser...
start "" "https://dashboard.render.com/login?next=%2Fselect-repo%3Ftype%3Dblueprint"
timeout /t 3 /nobreak >nul
echo.
echo IN THAT BROWSER WINDOW:
echo   1. Click  GitHub
echo   2. Sign in if asked (same as shyam1-jpg)
echo   3. Authorize Render
echo   4. Select  aurafx-elite  repo
echo   5. Click  Apply
echo   6. Wait for LIVE (green)
echo.
echo Then opening GoDaddy DNS...
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
echo.
echo GODADDY:
echo   A      @    216.24.57.1
echo   CNAME  www  aurafx-elite.onrender.com
echo   SAVE ALL
echo.
pause
