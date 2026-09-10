@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22+ is required. Install it from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo First launch: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

start "Cursor Usage" /B "%~dp0node_modules\electron\dist\electron.exe" .
exit /b 0
