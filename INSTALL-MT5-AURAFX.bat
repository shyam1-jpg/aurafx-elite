@echo off
title AuraFX Elite — Install into MetaTrader 5
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   AuraFX Elite - MT5 Install Helper
echo ========================================
echo.

set "SRC=%~dp0MQL5"
if not exist "%SRC%\Indicators\AuraFX_Elite_Signals.mq5" (
  echo [ERROR] Cannot find AuraFX files at:
  echo   %SRC%
  pause
  exit /b 1
)

set "DEST="
for %%D in (
  "%APPDATA%\MetaQuotes\Terminal"
) do (
  if exist %%D (
    for /f "delims=" %%T in ('dir /b /ad "%%~D" 2^>nul') do (
      if exist "%%~D\%%T\MQL5\Indicators" set "DEST=%%~D\%%T\MQL5"
    )
  )
)

if "%DEST%"=="" (
  echo MT5 data folder not found automatically.
  echo.
  echo DO THIS:
  echo   1. Install MetaTrader 5 from your broker or https://www.metatrader5.com
  echo   2. Open MT5 - File - Open Data Folder
  echo   3. Copy the path shown e.g. ...\Terminal\XXXXXXXX\MQL5
  echo   4. Run this bat again OR copy manually:
  echo        %SRC%\Indicators  -^>  MQL5\Indicators
  echo        %SRC%\Experts     -^>  MQL5\Experts
  echo        %SRC%\Include     -^>  MQL5\Include
  echo        %SRC%\Presets     -^>  MQL5\Presets
  echo.
  start "" "https://www.metatrader5.com/en/download"
  pause
  exit /b 1
)

echo Found MT5 folder:
echo   %DEST%
echo.
echo Copying AuraFX files...
xcopy /Y /I "%SRC%\Indicators\*.mq5" "%DEST%\Indicators\" >nul
xcopy /Y /I "%SRC%\Experts\*.mq5" "%DEST%\Experts\" >nul
xcopy /Y /I "%SRC%\Include\*.mqh" "%DEST%\Include\" >nul
if exist "%SRC%\Presets" xcopy /Y /I "%SRC%\Presets\*.set" "%DEST%\Presets\" >nul

echo.
echo [OK] Files copied.
echo.
echo NEXT in MetaTrader 5:
echo   1. Press F4 - MetaEditor opens
echo   2. Open Indicators - AuraFX_Elite_Signals.mq5 - press F7 Compile
echo   3. Open Experts - AuraFX_Elite_EA.mq5 - press F7 Compile
echo   4. In MT5: Navigator - Indicators - Custom - drag onto XAUUSD H1 chart
echo   5. Turn ON "Algo Trading" button if using the EA
echo.
echo Monday demo test: see MONDAY-DEMO-TEST.txt
echo.
if /I not "%~1"=="/silent" pause
