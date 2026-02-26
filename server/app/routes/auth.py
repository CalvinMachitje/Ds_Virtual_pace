# app/routes/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import timedelta
import re
import logging

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
logger = logging.getLogger(__name__)

ALLOWED_REDIRECT_DOMAINS = [
    "localhost:5173",
    "127.0.0.1:5173",
    "gig-connect.vercel.app",
    "www.gig-connect.vercel.app"
]

def is_strong_password(password: str) -> bool:
    return all([
        len(password) >= 10,
        re.search(r"[A-Z]", password),
        re.search(r"[a-z]", password),
        re.search(r"[0-9]", password),
        re.search(r"[!@#$%^&*(),.?\":{}|<>]", password)
    ])

# ────────────────────────────────
# POST /signup
# ────────────────────────────────
@bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    role = (data.get("role") or "").strip().lower()

    if not all([email, password, full_name, role]):
        return jsonify({"error": "Missing required fields"}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    if role not in ["buyer", "seller"]:
        return jsonify({"error": "Role must be 'buyer' or 'seller'"}), 400

    if not is_strong_password(password):
        return jsonify({"error": "Password must be ≥10 chars with uppercase, lowercase, number, special char"}), 400

    try:
        sign_up = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": full_name, "phone": phone, "role": role}}
        })

        user = sign_up.user
        if not user:
            return jsonify({"error": "User creation failed"}), 500

        # Insert into profiles table
        supabase.table("profiles").insert({
            "id": user.id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "role": role,
            "created_at": "now()"
        }).execute()

        # If no session returned (email confirmation needed)
        if not sign_up.session:
            return jsonify({"success": True, "message": "Check email to confirm", "email_confirmation_sent": True}), 200

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "success": True,
            "access_token": access,
            "refresh_token": refresh,
            "user": {"id": user.id, "email": email, "full_name": full_name, "role": role, "phone": phone}
        }), 201

    except Exception as e:
        logger.error(f"Signup error {email}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to create account"}), 500


# ────────────────────────────────
# POST /login
# ────────────────────────────────
@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        auth_resp = supabase.auth.sign_in_with_password({"email": email, "password": password})

        if not auth_resp.user:
            return jsonify({"error": "Invalid credentials"}), 401

        user = auth_resp.user
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
        profile = profile_res.data if profile_res and profile_res.data else {}

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "success": True,
            "access_token": access,
            "refresh_token": refresh,
            "user": {"id": user.id, "email": user.email, **profile}
        }), 200

    except Exception as e:
        logger.error(f"Login error {email}: {str(e)}", exc_info=True)
        return jsonify({"error": "Login failed"}), 500


# ────────────────────────────────
# POST /admin-login – FIXED VERSION
# ────────────────────────────────
@bp.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        # Step 1: Authenticate
        auth_res = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user = auth_res.user
        if not user:
            logger.warning(f"Login failed for {email}: no user object")
            return jsonify({"error": "Invalid email or password"}), 401

        logger.info(f"Auth success: {email} (id: {user.id})")

        # Step 2: Safe admin record check — avoid .data crash
        admin_res = supabase.table("admins")\
            .select("admin_level, permissions")\
            .eq("id", user.id)\
            .maybe_single().execute()

        if admin_res is None or not hasattr(admin_res, 'data') or admin_res.data is None:
            logger.info(f"No admin record found for {email} (id: {user.id})")
            return jsonify({"error": "Not an admin account"}), 403

        # Now safe to access .data
        admin_level = admin_res.data.get("admin_level", "standard")
        permissions = admin_res.data.get("permissions", {})

        # Step 3: Profile (optional)
        profile_res = supabase.table("profiles")\
            .select("*")\
            .eq("id", user.id)\
            .maybe_single().execute()
        profile = profile_res.data if profile_res and hasattr(profile_res, 'data') and profile_res.data else {}

        # Step 4: Tokens
        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "success": True,
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": "admin",
                "admin_level": admin_level,
                "permissions": permissions,
                **profile
            }
        }), 200

    except Exception as e:
        error_str = str(e)
        logger.error(f"Admin login failed for {email}: {error_str}", exc_info=True)

        if "invalid login credentials" in error_str.lower():
            return jsonify({"error": "Invalid email or password"}), 401

        if "missing response" in error_str.lower() or "204" in error_str:
            logger.warning(f"PostgREST 204 (no row) for admin check - treated as 403")
            return jsonify({"error": "Not an admin account"}), 403

        return jsonify({"error": "Authentication failed"}), 500

# ────────────────────────────────
# POST /logout
# ────────────────────────────────
@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        # Optional: revoke tokens if using blocklist (Redis)
        # redis_client.setex(f"blacklist_{get_jwt()['jti']}", timedelta(days=30), "true")
        supabase.auth.sign_out()
    except Exception as e:
        logger.warning(f"Logout error: {str(e)}")

    return jsonify({"success": True, "message": "Logged out"}), 200


# ────────────────────────────────
# GET /me – current user info
# ────────────────────────────────
@bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    try:
        profile_res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        profile = profile_res.data if profile_res and profile_res.data else None

        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        return jsonify({"success": True, "user": profile}), 200

    except Exception as e:
        logger.error(f"/me failed {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch user info"}), 500
    
@bp.route("/debug/supabase", methods=["GET"])
def debug_supabase():
    status = supabase.check_connection()
    return jsonify(status), 200