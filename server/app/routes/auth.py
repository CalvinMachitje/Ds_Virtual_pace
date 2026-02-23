# server/app/routes/auth.py
from flask import Blueprint, request, jsonify
from app.services.supabase_service import supabase
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from datetime import timedelta

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name")
    phone = data.get("phone")
    role = data.get("role")

    if not all([email, password, full_name, role]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        sign_up = supabase.client.auth.sign_up({
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
            return jsonify({"error": sign_up.error.message}), 400

        user = sign_up.user
        if not user:
            return jsonify({"error": "Signup failed"}), 500

        # Insert profile
        profile = {
            "id": user.id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "role": role
        }
        supabase.client.table("profiles").insert(profile).execute()

        # If email confirmation required
        if not sign_up.session:
            return jsonify({
                "message": "User created. Please confirm your email.",
                "email_confirmation_sent": True
            }), 200

        # Auto-confirmed
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
        return jsonify({"error": str(e)}), 500

@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        auth = supabase.client.auth.sign_in_with_password({"email": email, "password": password})
        if auth.error:
            return jsonify({"error": auth.error.message}), 401

        user = auth.user
        profile = supabase.client.table("profiles").select("*").eq("id", user.id).single().execute().data

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        return jsonify({
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                **(profile or {})
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    try:
        auth = supabase.client.auth.sign_in_with_password({"email": email, "password": password})
        if auth.error:
            return jsonify({"error": auth.error.message}), 401

        user = auth.user
        admin = supabase.client.table("admins").select("admin_level").eq("id", user.id).single().execute()

        if not admin.data:
            return jsonify({"error": "Not an admin account"}), 403

        access = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
        refresh = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

        profile = supabase.client.table("profiles").select("*").eq("id", user.id).single().execute().data

        return jsonify({
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": "admin",
                "admin_level": admin.data["admin_level"],
                **(profile or {})
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/oauth/<provider>", methods=["POST"])
def oauth(provider):
    if provider not in ["google", "facebook"]:
        return jsonify({"error": "Unsupported provider"}), 400

    redirect_to = request.json.get("redirectTo", f"{request.host_url}dashboard")

    try:
        url = supabase.client.auth.get_oauth_url(provider=provider, redirect_to=redirect_to)
        return jsonify({"redirectUrl": url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/resend-confirmation", methods=["POST"])
def resend():
    email = request.json.get("email")
    if not email:
        return jsonify({"error": "Email required"}), 400

    try:
        res = supabase.client.auth.resend({"type": "signup", "email": email})
        if res.error:
            return jsonify({"error": res.error.message}), 400
        return jsonify({"message": "Confirmation resent"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500