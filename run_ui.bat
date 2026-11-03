@echo off
setlocal

rem Copies the UI to a working folder (no node_modules, build output, git history, server, db or docs),
rem installs packages there and starts the dev server. Edit DEST to change where it runs from.
rem Needs Node.js 20 or newer on the PATH. The API should already be running (see VITE_API_PROXY in .env.local).

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=C:\dev\princess-ui"

if /i "%SRC%"=="%DEST%" (
  echo DEST is the same as the source folder; edit DEST in this file.
  exit /b 1
)

echo Copying %SRC% to %DEST% ...
robocopy "%SRC%" "%DEST%" /MIR /XD node_modules dist .git server db docs /XF run_ui.bat /NFL /NDL /NJH /NJS /NP
rem Robocopy exit codes of 8 or more mean a failure.
if errorlevel 8 (
  echo Copy failed.
  exit /b 1
)

cd /d "%DEST%"

rem Packages are installed here, not copied, because some are built for the operating system they were installed on.
rem "npm ci" would wipe node_modules every run, so use "npm install", which is quick when nothing changed.
call npm install
if errorlevel 1 (
  echo npm install failed.
  exit /b 1
)

echo Starting the UI ...
call npm run dev -- --host
endlocal
