@echo off
setlocal enabledelayedexpansion
title Antigravity Phone Connect - Tailscale Access

:: Navigate to script directory
cd /d "%~dp0"

echo ===================================================
echo   Antigravity Phone Connect - Tailscale Access
echo ===================================================
echo.

:: 0. Cleanup old server processes
echo [0/2] Cleaning up orphans...
taskkill /f /im node.exe /fi "WINDOWTITLE eq AG_SERVER_PROC*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: 1. Ensure dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing Node.js dependencies...
    call npm install
)

:: 2. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js missing.
    pause
    exit /b
)

:: 3. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python missing.
    pause
    exit /b
)

:: 4. Check for .env file
if exist ".env" goto ENV_FOUND
if exist "%~dp0.env" goto ENV_FOUND

echo [WARNING] .env file not found.
echo.

if exist ".env.example" (
    echo [INFO] Creating .env from .env.example...
    copy .env.example .env >nul
    echo [SUCCESS] .env created from template!
    echo [ACTION] Please update .env with your configuration if needed.
    pause
    exit /b
) else (
    echo [ERROR] .env.example not found. Cannot create .env template.
    pause
    exit /b
)

:ENV_FOUND
echo [INFO] .env configuration found.

:: 5. Launch via Python launcher
echo [1/1] Launching Antigravity Phone Connect...
echo (Access via Tailscale hostname or local IP)
python launcher.py

:: 6. Auto-close when done
exit
