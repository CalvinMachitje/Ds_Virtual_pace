# app/middleware/auth_middleware.py
import os
import json
from functools import wraps
from flask import request, jsonify, g
import requests
from jose import jwt, JWTError
from app.services.redis_service import redis_client

# Load secret from env
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"


def get_user_from_auth_service(token: str):
    """
    Optionally verify token directly via auth-service.
    """
    try:
        response = requests.post(
            f"http://auth-service:5001/api/auth/verify-token",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        if response.status_code == 200:
            return response.json()  # expects { "user_id": "...", "role": "...", "admin_level": "...", ... }
    except Exception:
        return None
    return None


def verify_jwt(token: str):
    """
    Decode and verify JWT locally.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        jti = payload.get("jti")
        if jti:
            # Check blacklist in Redis
            if redis_client and redis_client.get(f"blacklist:{jti}") == "true":
                return None
        return payload
    except JWTError:
        return None


def jwt_required(admin_only=False):
    """
    Flask route decorator for JWT-protected routes.
    If admin_only=True, only allows admin users.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            token = None
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

            if not token:
                return jsonify({"error": "Missing token"}), 401

            payload = verify_jwt(token)
            if not payload:
                # fallback to auth-service verify endpoint
                payload = get_user_from_auth_service(token)
                if not payload:
                    return jsonify({"error": "Invalid or expired token"}), 401

            g.user_id = payload.get("sub") or payload.get("user_id")
            g.role = payload.get("role")
            g.admin_level = payload.get("admin_level")

            if admin_only and g.role != "admin":
                return jsonify({"error": "Admin privileges required"}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator