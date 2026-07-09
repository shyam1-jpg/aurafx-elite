@echo off
title Aura FX Elite AI — local demo
cd /d "%~dp0aura-fx-elite-ai"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo Starting http://localhost:3000
echo   Dashboard: http://localhost:3000/dashboard
echo   Admin:     http://localhost:3000/admin
echo.
call npm run dev
