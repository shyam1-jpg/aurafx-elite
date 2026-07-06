@echo off
setlocal
cd /d "%~dp0"

echo.
echo  Parslia Kitchen OS - push to GitHub
echo  Target: https://github.com/shyam1-jpg/parslia-kitchen-os
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed. Install from https://git-scm.com/
  pause
  exit /b 1
)

set REPO=https://github.com/shyam1-jpg/parslia-kitchen-os.git

if exist ".git" (
  echo Using existing git repo in this folder...
) else (
  echo Initialising git repo...
  git init
  git branch -M main
)

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Parslia Kitchen OS marketing site"
) else (
  echo No new changes to commit.
)

git remote get-url parslia >nul 2>&1
if errorlevel 1 git remote add parslia %REPO%

echo.
echo Pushing to parslia-kitchen-os (main)...
git push -u parslia HEAD:main
if errorlevel 1 (
  echo.
  echo Push failed. Sign in to GitHub when prompted, or run:
  echo   gh auth login
  echo Then run this script again.
  pause
  exit /b 1
)

echo.
echo Done. Enable GitHub Pages: Settings - Pages - branch main - root /
echo.
pause
