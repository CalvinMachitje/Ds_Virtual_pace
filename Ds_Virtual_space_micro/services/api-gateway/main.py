# API Gateway - Main Application
# services/api-gateway/main.py
from flask import Flask, request, jsonify
import requests
from jose import jwt
import os

from app.middleware.auth_middleware import jwt_required



app = Flask(__name__)

# 🔥 Use localhost for campus (no Docker)
SERVICES = {
    "auth": "http://localhost:5001",
    "users": "http://localhost:5002",
    "admin": "http://localhost:5003",
    "support": "http://localhost:5004",
}

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret")

# Public routes that don't require auth
PUBLIC_PATHS = [
    "/auth/login",
    "/auth/signup",
    "/auth/refresh",
    "/auth/oauth",
    "/health"
]


def is_public_path(path):
    return any(path.startswith(p) for p in PUBLIC_PATHS)


def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])

        if payload.get("type") != "access":
            return None

        return {
            "user_id": payload.get("sub"),
            "role": payload.get("role")
        }

    except Exception:
        return None


@app.route("/<service>/<path:path>", methods=["GET", "POST", "PUT", "DELETE"])
def gateway(service, path):

    if service not in SERVICES:
        return jsonify({"error": "Service not found"}), 404

    full_path = f"/{service}/{path}"

    headers = dict(request.headers)

    # 🔐 AUTH CHECK
    if not is_public_path(full_path):

        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401

        token = auth_header.split(" ")[1]
        user = verify_token(token)

        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401

        # Attach user context
        headers["X-User-Id"] = user["user_id"]
        headers["X-User-Role"] = user["role"] or "user"

    # Forward request
    url = f"{SERVICES[service]}/api/{path}"

    try:
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            json=request.get_json(silent=True),
            timeout=10
        )

        return response.content, response.status_code

    except requests.exceptions.RequestException:
        return jsonify({"error": "Service unavailable"}), 503

@app.route("/users/<path:path>", methods=["GET","POST","PUT","DELETE"])
@jwt_required()
def users_proxy(path):
    # g.user_id, g.role, g.admin_level are available here
    url = f"{SERVICES['users']}/{path}"
    response = requests.request(
        method=request.method,
        url=url,
        headers=request.headers,
        json=request.get_json(silent=True)
    )
    return response.content, response.status_code


@app.route("/admin/<path:path>", methods=["GET","POST","PUT","DELETE"])
@jwt_required(admin_only=True)
def admin_proxy(path):
    url = f"{SERVICES['admin']}/{path}"
    response = requests.request(
        method=request.method,
        url=url,
        headers=request.headers,
        json=request.get_json(silent=True)
    )
    return response.content, response.status_code

@app.route("/health")
def health():
    return {"status": "gateway running"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)