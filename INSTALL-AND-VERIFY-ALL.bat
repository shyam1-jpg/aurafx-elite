@echo off
title AuraFX Elite - Install ALL + Verify
cd /d "%~dp0"
echo.
echo ================================================
echo   AuraFX - INSTALL ALL PRODUCTS + VERIFY BUILD
echo ================================================
echo.
call "%~dp0INSTALL-MT5-AURAFX.bat" /silent
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify-mt5-build.ps1"
set VERIFY=%ERRORLEVEL%
if "%VERIFY%"=="0" (echo [SUCCESS] All products OK) else (echo [WARNING] Some failed)
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
if not "%VERIFY%"=="0" pause
exit /b %VERIFY%
