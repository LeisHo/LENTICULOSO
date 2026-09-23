@echo off
rem Double-click to run Lenticular Workbench.
rem Starts the local server (scripts\active\serve.py) and opens the browser.
rem The app cannot run from index.html opened directly: browsers block its
rem JavaScript modules on file:// pages. Keep this window open while you work.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found on PATH. Install Python 3 from https://www.python.org/ and try again.
  pause
  exit /b 1
)
python scripts\active\serve.py 8430 --open
if errorlevel 1 pause
