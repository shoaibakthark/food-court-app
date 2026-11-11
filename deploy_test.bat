@echo off
setlocal
echo ========================================================
echo   Deploying Changes to TEST / STAGING (Port 8080)
echo ========================================================

git checkout test
if errorlevel 1 (
    echo [ERROR] Failed to switch to test branch.
    goto error
)

git add .
if "%~1"=="" (
    set /p msg="Enter commit message: "
) else (
    set msg=%*
)

git commit -m "%msg%"
git push origin test
if errorlevel 1 (
    echo [ERROR] Failed to push to test branch on GitHub.
    goto error
)

echo.
echo Connecting to server and updating Test containers...
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-test && git pull origin test && docker compose -p foodcourt-test up -d --build"
if errorlevel 1 (
    echo [ERROR] Failed to update test containers on server.
    goto error
)

echo.
echo ========================================================
echo   SUCCESS: Test deployment is live at:
echo   http://13.127.45.22:8080
echo ========================================================
goto end

:error
echo [ERROR] Deployment failed. Check the error message above.

:end
endlocal
