# app/__init__.py
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    app = Flask(__name__)

    # ── Secure Config ────────────────────────────────────────────────────
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    if not app.config["JWT_SECRET_KEY"]:
        raise ValueError("JWT_SECRET_KEY not set in .env")

    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    if not app.config["SECRET_KEY"]:
        raise ValueError("SECRET_KEY not set in .env")

    # JWT settings — short access, long refresh, secure cookies
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]  # or ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = not app.debug          # HTTPS only in prod
    app.config["JWT_COOKIE_CSRF_PROTECT"] = True
    app.config["JWT_COOKIE_SAMESITE"] = "Strict"

    # CORS — ONLY allow your frontend domains
    frontend_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://yourapp.com",
        "https://www.yourapp.com",
        "https://gig-connect.vercel.app",  # ← add your real frontend URL(s)
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

    # JWT Manager
    jwt = JWTManager(app)

    # SocketIO — restrict CORS
    socketio = SocketIO(
        app,
        cors_allowed_origins=frontend_origins,
        async_mode="threading"  # or "gevent" / "eventlet" in prod
    )

    # Register blueprints
    from app.routes.admin import bp as admin_bp
    from app.routes.buyer import bp as buyer_bp
    from app.routes.seller import bp as seller_bp
    from app.routes.shared import bp as shared_bp

    app.register_blueprint(admin_bp)
    app.register_blueprint(buyer_bp)
    app.register_blueprint(seller_bp)
    app.register_blueprint(shared_bp)

    # Health check (public — can add auth if needed)
    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "socketio": "enabled",
            "environment": "development" if app.debug else "production"
        }), 200

    return app, socketio

app, socketio = create_app()

# Import socketio handlers AFTER app creation
from app.socket_handlers import init_socketio
init_socketio(socketio)

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5000,
        allow_unsafe_werkzeug=True
    )