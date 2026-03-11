# services/auth-service/main.py

import os
import logging
from dotenv import load_dotenv

from app import create_app
from extensions.extensions import socketio, init_redis, init_extensions, setup_logging

# ────────────────────────────────────────────────
# Load environment variables
# ────────────────────────────────────────────────
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────
# Create Flask App
# ────────────────────────────────────────────────
app = create_app()

# ────────────────────────────────────────────────
# Initialize extensions only in main process
# ────────────────────────────────────────────────
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    logger.info("Initializing extensions...")
    init_redis(app)
    init_extensions(app)
else:
    logger.info("Skipping extension init in reloader process")

# ────────────────────────────────────────────────
# Health check
# ────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return {
        "status": "ok",
        "service": "auth-service"
    }

# ────────────────────────────────────────────────
# Start server
# ────────────────────────────────────────────────
if __name__ == "__main__":

    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    logger.info("=" * 60)
    logger.info(f"Starting Auth Service on port {port}")
    logger.info("=" * 60)

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=debug
    )