# server/app/__init__.py

from datetime import datetime, timedelta
import uuid
from flask import Flask, g, jsonify, request
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from werkzeug.exceptions import HTTPException
import logging
import os
from dotenv import load_dotenv

from .extensions import (
    socketio,
    jwt,
    limiter,
    cors,
    migrate,
    mail,
    cache,
    compress,
    talisman,
    init_redis,
    setup_logging,
    redis_client
)

load_dotenv()
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Secure Config ───────────────────────────

    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY not set")

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY") or os.urandom(32).hex(),
        JWT_SECRET_KEY=jwt_secret,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=45),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=7),
        JWT_TOKEN_LOCATION=["headers"],
        JWT_COOKIE_SECURE=True,
        JWT_COOKIE_SAMESITE="Strict",
        JWT_COOKIE_CSRF_PROTECT=True,
        REDIS_URL=os.getenv("REDIS_URL"),
    )

    # ── Logging ────────────────────────────────
    setup_logging(app)

    # ── Redis (ONLY ONCE) ──────────────────────
    init_redis(app)

    # ── CORS (NO WILDCARD IN PROD) ─────────────
    frontend_origins = os.getenv("FRONTEND_ORIGINS", "http://196.253.26.113:5173").split(",")

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": frontend_origins}},
        supports_credentials=True
    )

    # ── Initialize Extensions ──────────────────
    jwt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)
    cache.init_app(app)
    compress.init_app(app)
    talisman.init_app(app, force_https=False)

    # ── JWT Blocklist ──────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        if not redis_client:
            return False
        jti = jwt_payload.get("jti")
        return redis_client.get(f"blacklist:{jti}") == "true"

    # ── SocketIO ───────────────────────────────
    socketio.init_app(
        app,
        cors_allowed_origins=frontend_origins,
        message_queue=app.config["REDIS_URL"] if redis_client else None,
        async_mode="threading"
    )

    # ── Register Blueprints ────────────────────
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

    @app.before_request
    def enforce_token_expiration():
        if request.path.startswith("/api/"):
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()
                if claims:
                    exp = claims.get("exp")
                    if exp and datetime.utcnow().timestamp() > exp:
                        return jsonify({"error": "Session expired"}), 401
            except Exception:
                pass

    @app.after_request
    def inject_request_id(response):
        response.headers["X-Request-ID"] = g.request_id
        return response

    # ── Health Check ───────────────────────────
    @app.route("/api/health")
    def health():
        redis_status = "ok" if redis_client else "down"
        return jsonify({
            "status": "ok",
            "redis": redis_status,
            "timestamp": datetime.utcnow().isoformat()
        })

    # ── Global Error Handler (NO RAW ERRORS) ───
    @app.errorhandler(Exception)
    def handle_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code

        logger.exception("Unhandled exception")
        return jsonify({"error": "Internal server error"}), 500

    return app