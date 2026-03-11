import re
import logging
import time
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, get_jwt
from extensions.extensions import safe_redis_call
from utils.audit import log_action
from constants import USER_FAIL_THRESHOLD, USER_LOCKOUT_MINUTES

logger = logging.getLogger(__name__)

def is_strong_password(password: str) -> tuple[bool, str]:
    """Return (is_valid, error_message)"""
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Must contain at least one lowercase letter"
    if not re.search(r"[0-9]", password):
        return False, "Must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Must contain at least one special character"
    return True, ""

def handle_login_fail(email: str, ip: str):
    fail_key = f"login_fail:{email}:{ip}"
    lock_key = f"login_lock:{email}:{ip}"

    fails = safe_redis_call("incr", fail_key, default=0) or 0
    safe_redis_call("expire", fail_key, 3600)
    if fails >= USER_FAIL_THRESHOLD:
        safe_redis_call("setex", lock_key, USER_LOCKOUT_MINUTES * 60, "locked")
        log_action(None, "account_locked", {"email": email, "ip": ip, "fails": fails})
    return fails, lock_key

def generate_tokens(user_id: str, additional_claims: dict = None):
    access = create_access_token(identity=user_id, additional_claims=additional_claims or {})
    refresh = create_refresh_token(identity=user_id)
    return access, refresh

def blacklist_jwt():
    try:
        jti = get_jwt()["jti"]
        exp = get_jwt()["exp"] - int(time.time()) + 3600
        safe_redis_call("setex", f"blacklist:{jti}", exp, "true")
    except Exception as e:
        logger.warning(f"Blacklist JWT failed: {str(e)}")