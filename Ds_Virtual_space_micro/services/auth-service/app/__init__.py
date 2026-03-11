
# services/auth-service/app/__init__.py
import os
import logging
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request, g
from flask_jwt_extended import get_jwt
from werkzeug.exceptions import HTTPException
from dotenv import load_dotenv

# ────────────────────────────────────────────────
# Import extensions
# ────────────────────────────────────────────────
from extensions.extensions import (
    socketio,
    jwt,
    limiter,
    cors,
    mail,
    cache,
    compress,
    talisman,
    migrate,
    init_extensions,
    setup_logging,
    redis_client,
)

# Load environment variables
load_dotenv()
logger = logging.getLogger(__name__)

def create_app() -> Flask:
    app = Flask(__name__)

    # ────────────────────────────────
    # 🔐 Configuration – Load from .env
    # ────────────────────────────────
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret or jwt_secret.strip() == "":
        raise RuntimeError("JWT_SECRET_KEY is missing or empty in .env file")

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("REDIS_URL not set – falling back to localhost")
        redis_url = "redis://localhost:6379/0"

    access_expires_min = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "10080"))
    refresh_expires_days = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30"))

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY") or os.urandom(32).hex(),
        JWT_SECRET_KEY=jwt_secret,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=access_expires_min),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=refresh_expires_days),
        JWT_TOKEN_LOCATION=["headers"],
        JWT_COOKIE_SECURE=not app.debug,
        JWT_COOKIE_SAMESITE="Strict",
        JWT_COOKIE_CSRF_PROTECT=True,
        JWT_VERIFY_EXPIRATION=True,
        REDIS_URL=redis_url,
        SESSION_COOKIE_SECURE=not app.debug,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=1),
        PROPAGATE_EXCEPTIONS=False,
    )

    # ────────────────────────────────
    # 📜 Logging
    # ────────────────────────────────
    setup_logging(app)

    # ────────────────────────────────
    # 🌍 Frontend origins
    # ────────────────────────────────
    frontend_origins = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://196.253.26.122:5173"
    ).split(",")
    app.config["FRONTEND_ORIGINS"] = [o.strip() for o in frontend_origins if o.strip()]

    # ────────────────────────────────
    # 🧠 Initialize extensions
    # ────────────────────────────────
    init_extensions(app)

    # ────────────────────────────────
    # 🔒 JWT blocklist loader
    # ────────────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get("jti")
        if not redis_client:
            return False
        return redis_client.get(f"blacklist:{jti}") == "true"

    # ────────────────────────────────
    # 📦 Register Blueprints
    # ────────────────────────────────
    from app.routes.auth import bp as auth_bp
    from app.routes.admin import bp as admin_bp
    from app.routes.buyer import bp as buyer_bp
    from app.routes.seller import bp as seller_bp
    from app.routes.shared import bp as shared_bp
    from app.routes.support import bp as support_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(buyer_bp)
    app.register_blueprint(seller_bp)
    app.register_blueprint(shared_bp)
    app.register_blueprint(support_bp)

    # ────────────────────────────────
    # 🆔 Request ID Middleware + CORS
    # ────────────────────────────────
    @app.before_request
    def handle_options():
        if request.method == "OPTIONS":
            response = app.make_response(('', 204))
            origin = request.headers.get("Origin")
            allowed = app.config["FRONTEND_ORIGINS"]
            if origin in allowed or "*" in allowed:
                response.headers["Access-Control-Allow-Origin"] = origin or "*"
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
                response.headers["Access-Control-Max-Age"] = "86400"
            return response

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        allowed = app.config["FRONTEND_ORIGINS"]
        if origin in allowed or "*" in allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # ────────────────────────────────
    # ❤️ Health Check
    # ────────────────────────────────
    @app.route("/api/health")
    def health():
        redis_status = "ok" if redis_client and redis_client.ping() else "failed"
        return jsonify({
            "status": "ok" if redis_status == "ok" else "degraded",
            "redis": redis_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # ────────────────────────────────
    # 🛑 Global Error Handler
    # ────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code
        logger.exception(f"[{getattr(g, 'request_id', 'unknown')}] Unhandled exception")
        return jsonify({"error": "Internal server error"}), 500

    return app