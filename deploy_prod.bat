@echo off
setlocal
echo ========================================================
echo   Promoting TEST to MAIN PRODUCTION (Port 80 / 443)
echo ========================================================

git checkout main
if errorlevel 1 (
    echo [ERROR] Failed to switch to main branch.
    goto error
)

echo Merging test into main...
git merge test
if errorlevel 1 (
    echo [ERROR] Merge conflict or failure. Resolve conflicts before proceeding.
    goto error
)

echo Pushing main to GitHub...
git push origin main
if errorlevel 1 (
    echo [ERROR] Failed to push to main branch on GitHub.
    goto error
)

echo Switching back to test branch for future development...
git checkout test

echo.
echo Connecting to server and updating Production containers...
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-app && git pull origin main && docker compose up -d --build"
if errorlevel 1 (
    echo [ERROR] Failed to update production containers on server.
    goto error
)

echo.
echo ========================================================
echo   SUCCESS: Production deployment is live at:
echo   http://13.127.45.22  (https://foodcourt.work.gd)
echo ========================================================
goto end

:error
echo [ERROR] Promotion to production failed. Check the error message above.

:end
endlocal
