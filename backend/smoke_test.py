"""
Smoke test script for CI pipeline verification.
Tests imports, database table creation, and FastAPI routing.
"""
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

def run_smoke_test():
    print("[CI Smoke Test] 1. Importing database engine & models...")
    from app.database import engine, SessionLocal
    from app import models

    print("[CI Smoke Test] 2. Verifying database table schema creation...")
    models.Base.metadata.create_all(bind=engine)
    print("[OK] Database tables verified.")

    print("[CI Smoke Test] 3. Importing FastAPI main application...")
    from app.main import app

    print("[CI Smoke Test] 4. Verifying API routes...")
    routes = [r.path for r in app.routes]
    critical_endpoints = [
        "/events",
        "/customers",
        "/staff",
        "/expenses",
        "/payments",
        "/auth/login",
        "/auth/users",
        "/food-items",
        "/decor-items",
    ]
    for ep in critical_endpoints:
        assert any(ep in r for r in routes), f"Critical route {ep} not found in app routes!"
        print(f"[OK] Route registered: {ep}")

    print(f"[OK] All critical routes registered! Total registered routes: {len(routes)}")
    print("[CI Smoke Test] ALL CHECKS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    try:
        run_smoke_test()
    except Exception as e:
        print(f"[CI Smoke Test] FAILED with error: {e}", file=sys.stderr)
        sys.exit(1)
