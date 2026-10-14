@echo off
title Food Court - Application Launcher
echo =========================================================
echo       Starting Food Court App (Backend + Frontend)
echo =========================================================
echo.

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo [1/2] Starting FastAPI Backend on http://0.0.0.0:8000 ...
start "Food Court - Backend (FastAPI)" cmd /k "cd /d ""%PROJECT_DIR%backend"" && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 >nul

echo [2/2] Starting Next.js Frontend on http://0.0.0.0:3000 ...
start "Food Court - Frontend (Next.js)" cmd /k "cd /d ""%PROJECT_DIR%frontend"" && npm run dev -- -H 0.0.0.0 -p 3000"

echo.
echo =========================================================
echo   Both services are now starting up!
echo   - Local PC access:  http://localhost:3000
echo   - LAN/Mobile access: Open your IP on port 3000
echo =========================================================
echo.
timeout /t 6
