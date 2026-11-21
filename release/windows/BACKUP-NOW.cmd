@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 LTS is not installed on this computer.
  echo Install it once from https://nodejs.org ^(choose the 22 LTS Windows Installer .msi; a per-user install is enough^), then double-click this file again.
  echo Nothing was changed.
  set RC=2
  goto :end
)
node app\release\launcher.js --backup --data "%~dp0data"
set RC=%ERRORLEVEL%
:end
echo.
if not defined MASLUL_NO_PAUSE pause
exit /b %RC%
