# server/app/__init__.py
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import logging
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)

load_dotenv()

def create_app():
    app = Flask(__name__)

    # ── Secure Config ────────────────────────────────────────────────────
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret:
        raise ValueError("JWT_SECRET_KEY not set in .env")

    app.config["JWT_SECRET_KEY"] = jwt_secret
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or os.urandom(24).hex()

    # JWT settings
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=45)
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_SECURE"] = True
    app.config["JWT_COOKIE_SAMESITE"] = "Strict"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = True
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)

    # CORS – explicit and safe
    frontend_origins = [
        "https://gig-connect.vercel.app",
        "https://*.gig-connect.vercel.app",
        "http://localhost:5173",          # keep for dev
    ]

    CORS(app, resources={
        r"/api/*": {
            "origins": frontend_origins,
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Authorization"],
            "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
        }
    })

    jwt = JWTManager(app)

    # SocketIO
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    socketio = SocketIO(
        app,
        cors_allowed_origins=frontend_origins,
        async_mode="threading",
        message_queue=redis_url,
        logger=True,
        engineio_logger=False
    )

    # ── Register Blueprints (CORRECT paths) ──────────────────────────────
    try:
        from app.routes.auth import bp as auth_bp
        app.register_blueprint(auth_bp)
        logger.info("Registered auth blueprint (/api/auth/*)")
    except ImportError as e:
        logger.error(f"Auth blueprint import failed: {e}")

    try:
        from app.routes.admin import bp as admin_bp
        app.register_blueprint(admin_bp)
        logger.info("Registered admin blueprint (/api/admin/*)")
    except ImportError as e:
        logger.error(f"Admin blueprint import failed: {e}")

    try:
        from app.routes.buyer import bp as buyer_bp
        app.register_blueprint(buyer_bp)
        logger.info("Registered buyer blueprint")
    except ImportError as e:
        logger.error(f"Buyer blueprint import failed: {e}")

    try:
        from app.routes.seller import bp as seller_bp
        app.register_blueprint(seller_bp)
        logger.info("Registered seller blueprint")
    except ImportError as e:
        logger.error(f"Seller blueprint import failed: {e}")

    try:
        from app.routes.shared import bp as shared_bp
        app.register_blueprint(shared_bp)
        logger.info("Registered shared blueprint")
    except ImportError as e:
        logger.error(f"Shared blueprint import failed: {e}")

    
    try:
        from app.routes.support import bp as support_bp
        app.register_blueprint(support_bp)
        logger.info("Registered support blueprint")
    except ImportError as e:
        logger.error(f"Support blueprint import failed: {e}")

    # ── Health check endpoint ────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "blueprints_loaded": list(app.blueprints.keys())
        }), 200

    # ── Global error handler ─────────────────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code

        logger.exception("Unhandled exception occurred")
        return jsonify({"error": "Internal server error"}), 500

    return app, socketio


# Create app
app, socketio = create_app()

# SocketIO handlers
from app.socket_handlers import init_socketio
init_socketio(socketio)


if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5000,
        allow_unsafe_werkzeug=True,
        log_output=True
    )