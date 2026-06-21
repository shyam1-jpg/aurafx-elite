@echo off
title GitHub CODE — read this window
color 0E
cd /d "%~dp0"
cls
echo.
echo ============================================================
echo   GITHUB LOGIN CODE — READ THIS WINDOW
echo ============================================================
echo.
echo Step 1: Wait below for a line like:
echo         First copy your one-time code: XXXX-XXXX
echo.
echo Step 2: Copy that code (8 characters with a dash)
echo.
echo Step 3: Paste at: https://github.com/login/device
echo.
echo Step 4: Click Continue, then Authorize
echo.
echo ============================================================
echo.
start "" "https://github.com/login/device"
gh auth login -h github.com -p https -w 2>&1 | tee "%TEMP%\aurafx-github-code.txt"
echo.
echo ============================================================
echo If you missed the code, open this file:
echo   %TEMP%\aurafx-github-code.txt
echo ============================================================
notepad "%TEMP%\aurafx-github-code.txt"
pause
