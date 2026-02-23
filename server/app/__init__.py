# app/__init__.py
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    app = Flask(__name__)

    # Config
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-me")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "another-secret-change-me")

    # CORS - allow frontend origin (update in production)
    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

    # JWT
    jwt = JWTManager(app)

    # SocketIO - use threading mode for simplicity (or gevent/eventlet in prod)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

    # Register blueprints
    from app.routes.admin import bp as admin_bp
    from app.routes.buyer import bp as buyer_bp
    from app.routes.seller import bp as seller_bp
    from app.routes.shared import bp as shared_bp
    # from app.routes.messages import bp as messages_bp  # if you have a separate one

    app.register_blueprint(admin_bp)
    app.register_blueprint(buyer_bp)
    app.register_blueprint(seller_bp)
    app.register_blueprint(shared_bp)
    # app.register_blueprint(messages_bp)

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok", "socketio": "enabled"}

    return app, socketio

app, socketio = create_app()

# Import socketio event handlers AFTER app is created
from app.socket_handlers import init_socketio

init_socketio(socketio)

if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)