import os
import hmac
import hashlib
import json
import base64
import time
import bcrypt

SECRET_KEY = os.getenv("SECRET_KEY", "foodcourt-super-secret-key-2026")


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using direct bcrypt."""
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_or_plain: str) -> bool:
    """Verify password against bcrypt hash or legacy plaintext string."""
    if not hashed_or_plain:
        return False
    if hashed_or_plain.startswith("$2b$") or hashed_or_plain.startswith("$2a$"):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_or_plain.encode("utf-8"))
        except Exception:
            return False
    # Legacy plaintext comparison
    return plain_password == hashed_or_plain


def is_legacy_plaintext(stored_password: str) -> bool:
    """Check if the stored password string is still legacy plaintext."""
    if not stored_password:
        return False
    return not (stored_password.startswith("$2b$") or stored_password.startswith("$2a$"))


def create_access_token(data: dict, expires_in_seconds: int = 7 * 86400) -> str:
    """Generate a tamper-proof signed session token using HMAC-SHA256."""
    payload = data.copy()
    payload["exp"] = int(time.time()) + expires_in_seconds
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def decode_access_token(token: str) -> dict | None:
    """Verify and decode a signed session token. Returns payload dict or None if invalid/expired."""
    if not token or "." not in token:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        if payload.get("exp") and time.time() > payload["exp"]:
            return None
        return payload
    except Exception:
        return None
