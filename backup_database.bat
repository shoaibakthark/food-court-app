@echo off
setlocal enabledelayedexpansion
title Food Court - Database Backup Utility

echo ===============================================================
echo        Food Court App - Automated Database Backup
echo ===============================================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%backend"

:: Run backup manager via backend Python environment
if exist "%SCRIPT_DIR%backend\venv\Scripts\python.exe" (
    "%SCRIPT_DIR%backend\venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, '.'); from app.backup_manager import execute_backup, get_backup_status; res = execute_backup(); print(''); print('STATUS:', res['message'] if res.get('success') else res.get('error')); print('Saved to:', res.get('filepath', 'Unknown')); print(''); stat = get_backup_status(); print('Total Backups in Storage:', stat['total_backups']); print('Free Disk Space:', stat['free_space_gb'], 'GB')"
) else (
    echo [ERROR] Virtual environment python.exe not found at %SCRIPT_DIR%backend\venv\Scripts\python.exe
    pause
    exit /b 1
)

echo.
echo ===============================================================
echo Backup process complete!
echo ===============================================================
echo.

if "%1" neq "--silent" (
    echo Press any key to close this window...
    pause >nul
)
