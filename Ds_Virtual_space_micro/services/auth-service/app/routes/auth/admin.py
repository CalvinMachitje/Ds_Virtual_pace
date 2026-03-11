from flask import request, jsonify
from flask_jwt_extended import current_app
import logging
from services.supabase_service import supabase
from utils.audit import log_action
from constants import RATE_LIMIT_ADMIN_LOGIN, ADMIN_FAIL_THRESHOLD, ADMIN_LOCKOUT_MINUTES
from utils import generate_tokens, safe_redis_call
from extensions.extensions import limiter

logger = logging.getLogger(__name__)
bp = current_app.blueprints.get("auth")

@bp.route("/admin-login", methods=["POST"])
@limiter.limit(RATE_LIMIT_ADMIN_LOGIN)
def admin_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    otp = data.get("otp")
    ip = request.remote_addr

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    fail_key = f"admin_fail:{email}:{ip}"
    lock_key = f"admin_lock:{email}:{ip}"

    if safe_redis_call("exists", lock_key):
        ttl = safe_redis_call("ttl", lock_key, default=0)
        return jsonify({"error": f"Too many failed attempts. Locked for {ttl // 60 + 1} min"}), 429

    try:
        auth_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = auth_res.user
        if not user:
            fails = safe_redis_call("incr", fail_key, default=0) or 0
            safe_redis_call("expire", fail_key, 1800)
            if fails >= ADMIN_FAIL_THRESHOLD:
                safe_redis_call("setex", lock_key, ADMIN_LOCKOUT_MINUTES*60, "locked")
                log_action(None, "admin_account_locked", {"email": email, "ip": ip, "fails": fails})
            return jsonify({"error": "Invalid email or password"}), 401

        admin_res = supabase.table("admins").select("*").eq("id", user.id).single().execute()
        admin = admin_res.data
        if not admin:
            return jsonify({"error": "Not registered as admin"}), 403

        if not user.email_confirmed_at:
            return jsonify({"error": "Email not confirmed", "needs_confirmation": True}), 403

        access, refresh = generate_tokens(str(user.id), {"role": "admin", "admin_level": admin["admin_level"]})
        log_action(user.id, "admin_login_success", {"email": email, "admin_level": admin["admin_level"], "ip": ip})

        return jsonify({"success": True, "access_token": access, "refresh_token": refresh, "user": {**admin, "email": user.email, "role": "admin"}}), 200

    except Exception as e:
        logger.exception(f"Admin login error {email}")
        return jsonify({"error": "Authentication failed"}), 500