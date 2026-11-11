# Food Court Application: Complete Architecture, CI/CD Pipeline & Workflow Guide

A comprehensive technical reference and operations handbook for the **Food Court Event Management & Catering Portal**.

---

## 📑 Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Dual Environment Setup (Main vs Test)](#2-dual-environment-setup-main-vs-test)
3. [Nginx Reverse Proxy & Traffic Routing](#3-nginx-reverse-proxy--traffic-routing)
4. [Git Branching Strategy](#4-git-branching-strategy)
5. [GitHub Actions CI/CD Pipeline](#5-github-actions-cicd-pipeline)
6. [Daily Developer Workflow (Step-by-Step)](#6-daily-developer-workflow-step-by-step)
7. [Automated One-Click Deployment Scripts](#7-automated-one-click-deployment-scripts)
8. [Database Isolation & Backups](#8-database-isolation--backups)
9. [Server Resource Management & Troubleshooting](#9-server-resource-management--troubleshooting)

---

## 1. System Architecture Overview

The system runs on an **Amazon EC2 (t3.micro)** Ubuntu host, serving both **Production (Main)** and **Staging (Test)** environments concurrently using Docker Compose and Nginx.

```
                              [ Internet / Clients ]
                                        │
                         ┌──────────────┴──────────────┐
                         │                             │
             Port 80 / 443 (HTTP/HTTPS)           Port 8080 (HTTP)
            foodcourt.work.gd / 13.127.45.22    13.127.45.22:8080
                         │                             │
                         ▼                             ▼
             ┌─────────────────────────────────────────────────┐
             │            NGINX REVERSE PROXY HOST             │
             └───────────┬─────────────────────────┬───────────┘
                         │                         │
            ┌────────────┴────────────┐            │
            │ MAIN (PRODUCTION)       │            │
            │                         │            │
            │ ┌─────────────────────┐ │            │
            │ │ Frontend (Port 3000)│ │            │
            │ │ Next.js 16 / React  │ │            │
            │ └──────────┬──────────┘ │            │
            │            │            │            │
            │ ┌──────────▼──────────┐ │            │
            │ │ Backend  (Port 8000)│ │            │
            │ │ FastAPI / Python    │ │            │
            │ └──────────┬──────────┘ │            │
            │            │            │            │
            │ ┌──────────▼──────────┐ │            │
            │ │ PostgreSQL 18 (Main)│ │            │
            │ │ DB: food_court      │ │            │
            │ └─────────────────────┘ │            │
            └─────────────────────────┘            │
                                                   │
                                      ┌────────────┴────────────┐
                                      │ TEST (STAGING)          │
                                      │                         │
                                      │ ┌─────────────────────┐ │
                                      │ │ Frontend (Port 3001)│ │
                                      │ │ Next.js 16 / React  │ │
                                      │ └──────────┬──────────┘ │
                                      │            │            │
                                      │ ┌──────────▼──────────┐ │
                                      │ │ Backend  (Port 8001)│ │
                                      │ │ FastAPI / Python    │ │
                                      │ └──────────┬──────────┘ │
                                      │            │            │
                                      │ ┌──────────▼──────────┐ │
                                      │ │ PostgreSQL 18 (Test)│ │
                                      │ │ DB: food_court_test │ │
                                      │ └─────────────────────┘ │
                                      └─────────────────────────┘
```

### Core Technologies

* **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
* **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0, Alembic, Pydantic v2
* **Database**: PostgreSQL 18 Alpine
* **Reverse Proxy**: Nginx 1.24 (with Let's Encrypt SSL)
* **Containerization**: Docker Compose
* **CI/CD**: GitHub Actions

---

## 2. Dual Environment Setup (Main vs Test)

Both installations reside independently on the same server, ensuring changes can be validated safely before releasing to customers.

| Parameter | Main (Production) | Test (Staging) |
| :--- | :--- | :--- |
| **Server Directory** | `/home/ubuntu/food-court-app` | `/home/ubuntu/food-court-test` |
| **Git Branch** | `main` | `test` |
| **Public URL** | `https://foodcourt.work.gd` or `http://13.127.45.22` | `http://13.127.45.22:8080` or `http://test.foodcourt.work.gd` |
| **API Docs (Swagger)** | `http://13.127.45.22/api/py/docs` | `http://13.127.45.22:8080/api/py/docs` |
| **Frontend Internal Port** | `3000` | `3001` |
| **Backend Internal Port** | `8000` | `8001` |
| **Database Name** | `food_court` | `food_court_test` |
| **Container Prefix** | `foodcourt-*` | `foodcourt-test-*` |

---

## 3. Nginx Reverse Proxy & Traffic Routing

The Nginx configuration file is located at `/etc/nginx/sites-available/foodcourt` (symlinked to `/etc/nginx/sites-enabled/foodcourt`).

### Key Routing Features:
1. **Traffic Separation**:
   - Requests arriving on port `80` / `443` are routed to internal ports `3000` (Frontend) and `8000` (FastAPI).
   - Requests arriving on port `8080` (or `test.foodcourt.work.gd`) are routed to `3001` (Test Frontend) and `8001` (Test FastAPI).
2. **FastAPI OpenAPI Schema Support**:
   - Swagger UI expects `/openapi.json`. Nginx explicitly handles `location = /openapi.json` to prevent Next.js from capturing the schema request and throwing 404 errors.
3. **WebSocket & Header Forwarding**:
   - Proxies include `Upgrade`, `Connection 'upgrade'`, `X-Real-IP`, and `X-Forwarded-Proto` headers.

### Testing and Reloading Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Git Branching Strategy

The repository follows a clean **Two-Branch Staging Model**:

```
[ Feature / Bugfix Work ]
           │
           ▼
     git checkout test
     git add . && git commit
     git push origin test
           │
           ▼
[ Auto/Manual Deploy to Test Server: 13.127.45.22:8080 ]
           │
           ▼
     Verify OK?
     ├── No  ──> Fix code on 'test' branch and re-push
     └── Yes ──> Proceed to Production
           │
           ▼
     git checkout main
     git merge test
     git push origin main
           │
           ▼
[ Auto/Manual Deploy to Live Production: 13.127.45.22 ]
```

### Git Rules:
- **Never commit directly to `main` without testing on `test` first.**
- When a hotfix is needed, make it on `test`, verify on `13.127.45.22:8080`, then merge to `main`.

---

## 5. GitHub Actions CI/CD Pipeline

The workflow file is located at [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Pipeline Stages:

1. **Backend CI (`backend-ci`)**:
   - Launches an ephemeral PostgreSQL container.
   - Compiles Python code (`python -m compileall`).
   - Runs database connection tests and FastAPI route registration smoke tests (`backend/smoke_test.py`).

2. **Frontend CI (`frontend-ci`)**:
   - Sets up Node.js 20.
   - Runs TypeScript strict type checking (`npx tsc --noEmit`).
   - Runs Next.js production build (`npm run build`).

3. **Docker Validation (`docker-validation`)**:
   - Verifies that both frontend and backend Dockerfiles build successfully.
   - Validates `docker-compose.yml` syntax.

4. **Continuous Deployment (`deploy-test` and `deploy-prod`)**:
   - **Triggered on push to `test`**: Executes SSH deployment to `/home/ubuntu/food-court-test`.
   - **Triggered on push to `main`**: Executes SSH deployment to `/home/ubuntu/food-court-app`.

### Required GitHub Secrets (For Automated Server Push):
In GitHub Repository $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**:
* `SSH_HOST`: `13.127.45.22`
* `SSH_USER`: `ubuntu`
* `SSH_KEY`: Content of your `food-court.pem` private key
* `SSH_PORT`: `22`

---

## 6. Daily Developer Workflow (Step-by-Step)

### Step 1: Work on the `test` Branch Locally
```bash
# Switch to test branch
git checkout test

# Make your changes in code
# Test locally if desired:
# cd backend && uvicorn app.main:app --reload
# cd frontend && npm run dev
```

### Step 2: Push to Test
```bash
git add .
git commit -m "feat: your new feature description"
git push origin test
```

### Step 3: Deploy to Test Server
```bash
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-test && git pull origin test && docker compose -p foodcourt-test up -d --build"
```

### Step 4: Verify on Test
Open in browser:
- **Test App**: [http://13.127.45.22:8080](http://13.127.45.22:8080)
- **Test Swagger API Docs**: [http://13.127.45.22:8080/api/py/docs](http://13.127.45.22:8080/api/py/docs)

Verify login, forms, calculations, and data persistence.

### Step 5: Promote to Main (Production)
```bash
# Switch to main
git checkout main

# Merge verified changes from test
git merge test

# Push to GitHub main branch
git push origin main

# Switch local workspace back to test for your next task
git checkout test
```

### Step 6: Deploy to Live Production Server
```bash
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-app && git pull origin main && docker compose up -d --build"
```

Verify live at: [http://13.127.45.22](http://13.127.45.22) or [https://foodcourt.work.gd](https://foodcourt.work.gd).

---

## 7. Automated One-Click Deployment Scripts

Two Windows batch scripts are provided in the repository root for single-command deployments:

### `deploy_test.bat` (Deploy to Test Server)
```bat
@echo off
setlocal
echo ========================================================
echo   Deploying Changes to TEST / STAGING (Port 8080)
echo ========================================================

git checkout test
if errorlevel 1 goto error

git add .
if "%~1"=="" (
    set /p msg="Enter commit message: "
) else (
    set msg=%*
)

git commit -m "%msg%"
git push origin test
if errorlevel 1 goto error

echo.
echo Connecting to server and updating Test containers...
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-test && git pull origin test && docker compose -p foodcourt-test up -d --build"
if errorlevel 1 goto error

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
```

### `deploy_prod.bat` (Promote to Live Production)
```bat
@echo off
setlocal
echo ========================================================
echo   Promoting TEST to MAIN PRODUCTION (Port 80 / 443)
echo ========================================================

git checkout main
if errorlevel 1 goto error

git merge test
if errorlevel 1 goto error

git push origin main
if errorlevel 1 goto error

git checkout test

echo.
echo Connecting to server and updating Production containers...
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "cd /home/ubuntu/food-court-app && git pull origin main && docker compose up -d --build"
if errorlevel 1 goto error

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
```

---

## 8. Database Isolation & Backups

### Isolation
* **Main Database**: `food_court` (managed inside container `foodcourt-db`)
* **Test Database**: `food_court_test` (managed inside container `foodcourt-test-db`)

Because PostgreSQL volumes and container names are distinct, creating, updating, or wiping data in the Test environment **will never impact Production data**.

### Manual Database Backup on Server
```bash
# Backup Main DB
docker exec -t foodcourt-db pg_dump -U postgres food_court > /home/ubuntu/backup_main_$(date +%Y%m%d).sql

# Backup Test DB
docker exec -t foodcourt-test-db pg_dump -U postgres food_court_test > /home/ubuntu/backup_test_$(date +%Y%m%d).sql
```

---

## 9. Server Resource Management & Troubleshooting

### Memory Protection for 1GB RAM Instances
Next.js builds require significant memory during bundling. The repository includes optimizations:
1. `frontend/next.config.ts`: `typescript: { ignoreBuildErrors: true }` inside Docker builds (typechecking is enforced upstream in GitHub Actions CI).
2. `frontend/Dockerfile`: `ENV NODE_OPTIONS="--max-old-space-size=512"` limits Node heap usage to prevent OOM errors.
3. Server Swap: 2.0GB swap is active on the server to safely absorb build spikes.

### Cleaning Unused Docker Data
If disk space or memory is constrained:
```bash
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "docker system prune -f"
```

### Checking Container Health:
```bash
ssh -i C:\Users\profe\.ssh\food-court.pem ubuntu@13.127.45.22 "docker ps"
```

### AWS Security Group Requirements:
Ensure the following Inbound Rules are configured in the AWS EC2 Console:
* **Port 22** (SSH) $\rightarrow$ `0.0.0.0/0`
* **Port 80** (HTTP - Main App) $\rightarrow$ `0.0.0.0/0`
* **Port 443** (HTTPS - Main App SSL) $\rightarrow$ `0.0.0.0/0`
* **Port 8080** (HTTP - Test Staging App) $\rightarrow$ `0.0.0.0/0`
