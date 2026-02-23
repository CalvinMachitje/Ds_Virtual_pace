# app/routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime, timedelta
import re
import uuid

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Allowed redirect domains (update with your real production domains!)
ALLOWED_REDIRECT_DOMAINS = [
    "localhost:5173",
    "127.0.0.1:5173",
    "yourapp.com",
    "www.yourapp.com",
    "gig-connect.vercel.app",  # ← add your actual frontend domains
]

# In-memory rate limiters (demo) — replace with Flask-Limiter + Redis in production
signup_attempts = {}          # {ip: {"count": int, "last": datetime}}
login_attempts = {}           # {email: {"count": int, "last": datetime}}
reset_attempts = {}           # {email: {"count": int, "last": datetime}}

def is_strong_password(password: str) -> bool:
    """Basic password strength check"""
    if len(password) < 10:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

# ────────────────────────────────────────────────
# POST /api/auth/signup
# User registration with rate limiting + validation
# ────────────────────────────────────────────────
@bp.route("/signup", methods=["POST"])
def signup():
    ip = request.remote_addr
    now = datetime.utcnow()

    # Rate limit: max 5 signups per IP per hour
    attempt = signup_attempts.get(ip, {"count": 0, "last": now - timedelta(hours=1)})
    if (now - attempt["last"]).total_seconds() < 3600:
        if attempt["count"] >= 5:
            return jsonify({"error": "Too many signup attempts. Try again in 1 hour"}), 429
    else:
        attempt = {"count": 0, "last": now}

    attempt["count"] += 1
    attempt["last"] = now
    signup_attempts[ip] = attempt

    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    phone = data.get("phone", "").strip()
    role = data.get("role", "").strip().lower()

    # Required fields
    if not all([email, password, full_name, role]):
        return jsonify({"error": "Missing required fields"}), 400

    # Validation
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    if role not in ["buyer", "seller"]:
        return jsonify({"error": "Invalid role. Must be 'buyer' or 'seller'"}), 400

    if len(full_name) < 2 or len(full_name) > 100:
        return jsonify({"error": "Full name must be 2–100 characters"}), 400

    if not is_strong_password(password):
        return jsonify({
            "error": "Password must be at least 10 characters, contain uppercase, lowercase, number, and special character"
        }), 400

    try:
        sign_up = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name,
                    "phone": phone,
                    "role": role
                }
            }
        })

        if sign_up.error:
            current_app.logger.warning(f"Signup attempt failed for {email}: {sign_up.error.message}")
            return jsonify({"error": "Signup failed. Email may already be in use."}), 400

        user = sign_up.user
        if not user:
            return jsonify({"error": "Signup failed"}), 500

        # Insert profile
        profile = {
            "id": user.id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "role": role,
            "created_at": "now()"
        }
        supabase.table("profiles").insert(profile).execute()

        # If email confirmation required (Supabase default)
        if not sign_up.session:
            return jsonify({
                "message": "User created. Please check your email to confirm.",
                "email_confirmation_sent": True
            }), 200

        # Auto-confirmed (rare in production)
        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": full_name,
                "role": role,
                "phone": phone
            }
        }), 201

    except Exception as e:
        current_app.logger.error(f"Signup error (email {email}): {str(e)}")
        return jsonify({"error": "Failed to create account"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/login
# Login with rate limiting
# ────────────────────────────────────────────────
@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    # Rate limit: max 10 attempts per email per 15 min
    now = datetime.utcnow()
    attempt = login_attempts.get(email, {"count": 0, "last": now - timedelta(minutes=15)})
    if (now - attempt["last"]).total_seconds() < 900:
        if attempt["count"] >= 10:
            return jsonify({"error": "Too many login attempts. Try again in 15 minutes"}), 429
    else:
        attempt = {"count": 0, "last": now}

    attempt["count"] += 1
    attempt["last"] = now
    login_attempts[email] = attempt

    try:
        auth = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if auth.error:
            current_app.logger.warning(f"Login failed for {email}: {auth.error.message}")
            return jsonify({"error": "Invalid email or password"}), 401

        user = auth.user
        profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute().data or {}

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                **profile
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Login error (email {email}): {str(e)}")
        return jsonify({"error": "Failed to log in"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/admin-login
# Admin login (strict role check)
# ────────────────────────────────────────────────
@bp.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        auth = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if auth.error:
            return jsonify({"error": "Invalid credentials"}), 401

        user = auth.user
        admin = supabase.table("admins").select("admin_level").eq("id", user.id).single().execute()

        if not admin.data:
            return jsonify({"error": "Not an admin account"}), 403

        profile = supabase.table("profiles").select("*").eq("id", user.id).single().execute().data or {}

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": "admin",
                "admin_level": admin.data["admin_level"],
                **profile
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Admin login error (email {email}): {str(e)}")
        return jsonify({"error": "Failed to log in"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/oauth/<provider>
# OAuth login/start (redirect validation)
# ────────────────────────────────────────────────
@bp.route("/oauth/<provider>", methods=["POST"])
def oauth(provider):
    if provider not in ["google", "facebook"]:
        return jsonify({"error": "Unsupported provider"}), 400

    data = request.get_json()
    redirect_to = data.get("redirectTo", f"{request.host_url}dashboard")

    # Validate redirect domain
    parsed = redirect_to.lower()
    allowed = any(domain in parsed for domain in ALLOWED_REDIRECT_DOMAINS)

    if not allowed:
        current_app.logger.warning(f"Invalid OAuth redirect attempt: {redirect_to}")
        redirect_to = f"{request.host_url}dashboard"  # safe fallback

    try:
        url = supabase.auth.get_oauth_url(provider=provider, redirect_to=redirect_to)
        return jsonify({"redirectUrl": url}), 200

    except Exception as e:
        current_app.logger.error(f"OAuth URL error ({provider}): {str(e)}")
        return jsonify({"error": "Failed to start OAuth flow"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/resend-confirmation
# Resend signup confirmation email (rate-limited)
# ────────────────────────────────────────────────
@bp.route("/resend-confirmation", methods=["POST"])
def resend():
    data = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email required"}), 400

    # Rate limit: max 3 resends per email per hour
    now = datetime.utcnow()
    attempt = reset_attempts.get(email, {"count": 0, "last": now - timedelta(hours=1)})
    if (now - attempt["last"]).total_seconds() < 3600:
        if attempt["count"] >= 3:
            return jsonify({"error": "Too many resend requests. Try again in 1 hour"}), 429
    else:
        attempt = {"count": 0, "last": now}

    attempt["count"] += 1
    attempt["last"] = now
    reset_attempts[email] = attempt

    try:
        res = supabase.auth.resend({"type": "signup", "email": email})
        if res.error:
            current_app.logger.warning(f"Resend confirmation failed for {email}: {res.error.message}")
            return jsonify({"error": "Failed to resend confirmation"}), 400

        return jsonify({"message": "Confirmation email resent"}), 200

    except Exception as e:
        current_app.logger.error(f"Resend confirmation error (email {email}): {str(e)}")
        return jsonify({"error": "Failed to resend confirmation"}), 500