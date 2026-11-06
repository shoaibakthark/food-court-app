# Food Court Event Management & Catering Portal

A comprehensive, full-stack event management, catering quotation, billing, staff payroll, and kitchen management application built for high-volume event catering operations.

---

## 🏗️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2, PostgreSQL
- **Database**: PostgreSQL 17 / 18
- **Containerization**: Docker & Docker Compose
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml`)

---

## 🚀 CI/CD Pipeline

The project includes an automated GitHub Actions pipeline located at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) that triggers on every push and pull request to `main`.

### Pipeline Stages

1. **Backend CI (`backend-ci`)**:
   - Spins up an ephemeral PostgreSQL 17 service container.
   - Installs Python 3.12 dependencies with pip caching.
   - Runs syntax compilation checks (`python -m compileall`).
   - Executes database schema initialization & route registration smoke tests (`backend/smoke_test.py`).

2. **Frontend CI (`frontend-ci`)**:
   - Sets up Node.js 20 with npm caching.
   - Runs clean dependency installation (`npm ci`).
   - Executes TypeScript type-checking (`npx tsc --noEmit`).
   - Validates Next.js standalone production build (`npm run build`).

3. **Docker Validation (`docker-validation`)**:
   - Builds both `backend/Dockerfile` and `frontend/Dockerfile` images via Docker Buildx.
   - Validates multi-service `docker-compose.yml` configuration.

4. **Continuous Deployment (`deploy`)**:
   - Triggers automatically when code is pushed to the `main` branch.
   - Deploys via SSH if secrets are configured, or skips gracefully if credentials are not yet added.

### Setting Up Automated Server Deployment (Optional)

To enable automatic deployment to your cloud VPS or server on every `git push origin main`:

1. In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add:
   - `SSH_HOST`: IP address or domain name of your server (e.g. `123.45.67.89`)
   - `SSH_USER`: SSH username (e.g. `ubuntu` or `root`)
   - `SSH_KEY`: Private SSH key for server access
   - `SSH_PORT`: (Optional, defaults to `22`)
   - `DEPLOY_PATH`: Path on server where repository is cloned (e.g. `/opt/food-court-app`)

---

## 💻 Local Development

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment

Run all services (Database + Backend + Frontend) locally or on a server with Docker Compose:

```bash
docker compose up -d --build
```
