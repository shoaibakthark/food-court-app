@echo off
title Food Court - Automatic Backup Task Scheduler Installer

echo ===============================================================
echo     Food Court - Schedule Daily Database Backup (11:59 PM)
echo ===============================================================
echo.

set SCRIPT_DIR=%~dp0
set BAT_PATH=%SCRIPT_DIR%backup_database.bat

echo Registering daily backup task in Windows Task Scheduler...
echo Target Script: %BAT_PATH%
echo Trigger: Daily at 23:59 (11:59 PM)
echo.

schtasks /create /tn "FoodCourt_Daily_Database_Backup" /tr "\"%BAT_PATH%\" --silent" /sc daily /st 23:59 /f

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Daily backup task registered successfully!
    echo The database will automatically backup to D:\food_court_backups every night at 11:59 PM.
) else (
    echo.
    echo [NOTICE] If access was denied, please Right-Click this file and choose 'Run as Administrator'.
)

echo.
pause
