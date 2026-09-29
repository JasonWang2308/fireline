@echo off
rem FIRELINE launcher - keep this file ASCII only (cmd.exe mis-reads UTF-8 batch files).
rem The menu itself lives in tools\fireline-menu.ps1 inside the game folder.
setlocal
set "GAME_DIR=%USERPROFILE%\fireline"
where git >nul 2>nul || (echo [ERROR] Git not found. Install it from https://git-scm.com & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] Node.js not found. Install it from https://nodejs.org & pause & exit /b 1)
if not exist "%GAME_DIR%\.git" (
  git clone https://github.com/JasonWang2308/fireline.git "%GAME_DIR%" || (pause & exit /b 1)
)
if not exist "%GAME_DIR%\tools\fireline-menu.ps1" git -C "%GAME_DIR%" pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File "%GAME_DIR%\tools\fireline-menu.ps1"
