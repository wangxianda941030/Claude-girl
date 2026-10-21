@echo off
cd /d "%~dp0"
rem 1) Electron installed in this folder
set "EXE=%~dp0node_modules\electron\dist\electron.exe"
if exist "%EXE%" goto run
rem 2) Reuse the Electron that ships with DSH
set "EXE=%USERPROFILE%\.dsh\electron\electron.exe"
if exist "%EXE%" goto run
rem 3) Otherwise install it with npm
where npm >nul 2>nul
if errorlevel 1 (
  echo Electron not found and npm is not available.
  echo Please install Node.js LTS from https://nodejs.org and run start.bat again.
  pause
  exit /b 1
)
echo First run: installing Electron, this takes a minute...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
set "EXE=%~dp0node_modules\electron\dist\electron.exe"
if not exist "%EXE%" (
  echo Install failed. Check your network and run start.bat again.
  pause
  exit /b 1
)
:run
start "" "%EXE%" "%~dp0."
