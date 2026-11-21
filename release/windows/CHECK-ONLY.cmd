@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 LTS is not installed. Install it from https://nodejs.org ^(Windows Installer .msi^), then double-click this file again.
  pause
  exit /b 2
)
node app\release\launcher.js --check --data "%~dp0data"
echo.
pause
