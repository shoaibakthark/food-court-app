@echo off
setlocal enabledelayedexpansion
title Food Court - Database Restore Utility

echo ===============================================================
echo        Food Court App - Database Restore Utility
echo ===============================================================
echo.
echo [WARNING] Restoring a backup will overwrite current database records!
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%backend"

if not exist "%SCRIPT_DIR%backend\venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment python.exe not found at %SCRIPT_DIR%backend\venv\Scripts\python.exe
    pause
    exit /b 1
)

:: Run Python restore script to list files and prompt user
"%SCRIPT_DIR%backend\venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, '.'); from app.backup_manager import get_backup_status, restore_backup; status = get_backup_status(); files = status.get('recent_backups', []); (print('[NOTICE] No backup dumps found in', status['backup_dir']), sys.exit(0)) if not files else None; print('Available Backup Dumps in', status['backup_dir'], ':'); [print(f'  [{idx+1}] {f[\"filename\"]} ({f[\"size_mb\"]} MB) - {f[\"created_at\"][:16]}') for idx, f in enumerate(files[:9])]; choice = input('\nEnter number to restore (or press ENTER for latest [1], Q to cancel): ').strip(); sys.exit(0) if choice.lower() == 'q' else None; idx = int(choice)-1 if choice.isdigit() and 1 <= int(choice) <= len(files) else 0; target = files[idx]['filepath']; confirm = input(f'\nAre you SURE you want to restore {files[idx][\"filename\"]}? (type YES): ').strip(); (res := restore_backup(target), print('\nRESULT:', res.get('message', res.get('error')))) if confirm.upper() == 'YES' else print('\nRestore cancelled.')"

echo.
echo ===============================================================
echo Process complete.
echo ===============================================================
echo.
pause
