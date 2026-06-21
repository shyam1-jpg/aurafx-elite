@echo off
title AuraFX — PayPal sandbox test setup
cd /d "%~dp0website"

if exist ".env" (
  echo .env already exists — edit it manually or delete first.
  notepad .env
  pause
  exit /b 0
)

copy /Y .env.example .env >nul
echo.
echo Created website\.env from template.
echo.
echo NEXT:
echo   1. Open https://developer.paypal.com/dashboard/applications/sandbox
echo   2. Create app - copy Client ID and Secret into .env
echo   3. Set PAYPAL_BUSINESS_EMAIL to your sandbox business email
echo   4. For local tests set ALLOW_MANUAL_PAYMENT_CONFIRM=1
echo   5. Restart START-LIVE-WEBSITE.bat
echo.
notepad .env
start "" "https://developer.paypal.com/dashboard/applications/sandbox"
pause
