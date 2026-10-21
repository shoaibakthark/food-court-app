import os
import shutil
import subprocess
import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

# Default permanent backup folder on D drive or fallback
DEFAULT_BACKUP_DIR = os.getenv("BACKUP_DIR", "D:\\food_court_backups")


def get_backup_dir() -> str:
    path = os.getenv("BACKUP_DIR", DEFAULT_BACKUP_DIR).strip()
    try:
        os.makedirs(path, exist_ok=True)
    except Exception:
        # Fallback to local user home folder if D drive unavailable
        path = os.path.join(os.path.expanduser("~"), "food_court_backups")
        os.makedirs(path, exist_ok=True)
    return path


def find_pg_dump() -> str:
    """Find pg_dump executable path across common Windows installation directories or PATH."""
    which_path = shutil.which("pg_dump")
    if which_path:
        return which_path

    known_paths = [
        r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    ]
    for p in known_paths:
        if os.path.exists(p):
            return p
    return "pg_dump"


def get_db_connection_params():
    """Extract host, port, user, password, dbname from DATABASE_URL."""
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return {
            "host": "localhost",
            "port": "5432",
            "user": "postgres",
            "password": "",
            "dbname": "food_court",
        }
    parsed = urlparse(db_url.replace("postgresql+psycopg2://", "postgresql://", 1))
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/") or "food_court",
    }


def execute_backup() -> dict:
    """
    Run pg_dump, save timestamped .dump file into permanent backup folder,
    and prune backups older than 30 days.
    """
    backup_dir = get_backup_dir()
    pg_dump_bin = find_pg_dump()
    params = get_db_connection_params()

    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d_%H%M%S")
    filename = f"food_court_backup_{timestamp_str}.dump"
    filepath = os.path.join(backup_dir, filename)

    env = os.environ.copy()
    if params["password"]:
        env["PGPASSWORD"] = params["password"]

    cmd = [
        pg_dump_bin,
        "-U", params["user"],
        "-h", params["host"],
        "-p", params["port"],
        "-d", params["dbname"],
        "-F", "c",  # Custom compressed format
        "-f", filepath,
    ]

    try:
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as err:
        error_msg = err.stderr or err.stdout or str(err)
        return {
            "success": False,
            "error": f"pg_dump execution failed: {error_msg.strip()}",
            "backup_dir": backup_dir,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to start pg_dump: {str(e)}",
            "backup_dir": backup_dir,
        }

    # Verify file was created and has non-zero size
    if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
        return {
            "success": False,
            "error": "Backup file was not created or is 0 bytes.",
            "backup_dir": backup_dir,
        }

    file_size_bytes = os.path.getsize(filepath)
    file_size_mb = round(file_size_bytes / (1024 * 1024), 2)

    # Prune old backups (> 30 days or keep at least the last 15 files)
    prune_old_backups(backup_dir)

    return {
        "success": True,
        "filename": filename,
        "filepath": filepath,
        "backup_dir": backup_dir,
        "size_bytes": file_size_bytes,
        "size_mb": file_size_mb,
        "created_at": now.isoformat(),
        "message": f"Successfully backed up database ({file_size_mb} MB) to {filepath}",
    }


def prune_old_backups(backup_dir: str, retention_days: int = 30, min_keep: int = 15):
    """Keep recent backups and safely remove older ones to conserve disk space."""
    try:
        files = [
            os.path.join(backup_dir, f)
            for f in os.listdir(backup_dir)
            if f.startswith("food_court_backup_") and (f.endswith(".dump") or f.endswith(".sql"))
        ]
        if len(files) <= min_keep:
            return

        files.sort(key=lambda x: os.path.getmtime(x))
        cutoff = datetime.datetime.now() - datetime.timedelta(days=retention_days)

        # Only delete files older than cutoff if we have more than min_keep
        for f in files[:-min_keep]:
            file_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(f))
            if file_mtime < cutoff:
                try:
                    os.remove(f)
                except Exception:
                    pass
    except Exception:
        pass


def get_backup_status() -> dict:
    """Return status, file count, latest backup, and disk space of the permanent backup folder."""
    backup_dir = get_backup_dir()

    total_space = 0
    free_space = 0
    try:
        total_space, _, free_space = shutil.disk_usage(backup_dir)
    except Exception:
        pass

    backup_files = []
    if os.path.exists(backup_dir):
        for f in os.listdir(backup_dir):
            if f.startswith("food_court_backup_") and (f.endswith(".dump") or f.endswith(".sql")):
                full_path = os.path.join(backup_dir, f)
                try:
                    st = os.stat(full_path)
                    backup_files.append({
                        "filename": f,
                        "filepath": full_path,
                        "size_mb": round(st.st_size / (1024 * 1024), 2),
                        "created_at": datetime.datetime.fromtimestamp(st.st_mtime).isoformat(),
                    })
                except Exception:
                    continue

    backup_files.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "backup_dir": backup_dir,
        "free_space_gb": round(free_space / (1024 ** 3), 2),
        "total_backups": len(backup_files),
        "latest_backup": backup_files[0] if backup_files else None,
        "recent_backups": backup_files[:10],
    }


def find_pg_restore() -> str:
    """Find pg_restore executable path across common Windows installation directories or PATH."""
    which_path = shutil.which("pg_restore")
    if which_path:
        return which_path

    known_paths = [
        r"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\15\bin\pg_restore.exe",
    ]
    for p in known_paths:
        if os.path.exists(p):
            return p
    return "pg_restore"


def restore_backup(filename_or_path: str) -> dict:
    """Restore database from a chosen .dump backup file."""
    backup_dir = get_backup_dir()
    if os.path.isabs(filename_or_path):
        target_path = filename_or_path
    else:
        target_path = os.path.join(backup_dir, filename_or_path)

    if not os.path.exists(target_path):
        return {"success": False, "error": f"Backup file not found: {target_path}"}

    pg_restore_bin = find_pg_restore()
    params = get_db_connection_params()

    env = os.environ.copy()
    if params["password"]:
        env["PGPASSWORD"] = params["password"]

    cmd = [
        pg_restore_bin,
        "-U", params["user"],
        "-h", params["host"],
        "-p", params["port"],
        "-d", params["dbname"],
        "--clean",
        "--if-exists",
        "--no-owner",
        target_path,
    ]

    try:
        subprocess.run(cmd, env=env, capture_output=True, text=True)
        return {
            "success": True,
            "filename": os.path.basename(target_path),
            "filepath": target_path,
            "message": f"Successfully restored database from {os.path.basename(target_path)}",
        }
    except Exception as e:
        return {"success": False, "error": f"Restore execution failed: {str(e)}"}
