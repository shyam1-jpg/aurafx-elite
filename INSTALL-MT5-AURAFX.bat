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
for %%D in ("%APPDATA%\MetaQuotes\Terminal") do (
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
echo Copying AuraFX files (skipping duplicate " - Copy" files)...

call :CopyMq5 "%SRC%\Indicators" "%DEST%\Indicators"
call :CopyMq5 "%SRC%\Experts" "%DEST%\Experts"
call :CopyMq5 "%SRC%\Scripts" "%DEST%\Scripts"
xcopy /Y /I "%SRC%\Include\*.mqh" "%DEST%\Include\" >nul
if exist "%SRC%\Presets" (
  for %%F in ("%SRC%\Presets\*.set") do (
    echo %%~nxF | findstr /I /C:" - Copy" >nul || copy /Y "%%F" "%DEST%\Presets\" >nul
  )
)

echo.
echo [OK] Files copied.
echo.

set "ME=C:\Program Files\MetaTrader 5\metaeditor64.exe"
if exist "%ME%" (
  echo Compiling AuraFX products in MetaEditor...
  call :CompileDir "%DEST%\Experts"
  call :CompileDir "%DEST%\Indicators"
  call :CompileDir "%DEST%\Scripts"
  echo [OK] Compile pass finished — check MetaEditor for any errors.
) else (
  echo MetaEditor not found — compile manually in MT5 ^(F4, then F7^).
)

echo.
echo NEXT in MetaTrader 5:
echo   1. Top toolbar: Algo Trading = GREEN
echo   2. Run script AuraFX_Check_Algo once (Navigator - Scripts)
echo   3. For fast demo: XAUUSD M1 + AuraFX_M1_Hyper_Scalper_EA
echo   4. For balanced: XAUUSD H1 + AuraFX_Universal_AI_EA
echo   5. Smiley face top-right = EA can trade
echo.
echo Help: FIX-SMILEY-ALGO-TRADING.txt and MT5-SIMPLE-SETUP.txt
echo.
if /I not "%~1"=="/silent" pause
exit /b 0

:CopyMq5
if not exist "%~1" exit /b 0
if not exist "%~2" mkdir "%~2" >nul 2>&1
for %%F in ("%~1\*.mq5") do (
  echo %%~nxF | findstr /I /C:" - Copy" >nul || copy /Y "%%F" "%~2\" >nul
)
exit /b 0

:CompileDir
if not exist "%~1" exit /b 0
for %%F in ("%~1\AuraFX_*.mq5") do (
  echo %%~nxF | findstr /I /C:" - Copy" >nul || (
    echo   Compiling %%~nxF ...
    start /wait "" "%ME%" /compile:"%%F" /log >nul 2>&1
  )
)
exit /b 0
