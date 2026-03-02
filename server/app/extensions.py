# server/app/extensions.py

"""
Centralized Flask extensions and shared instances.
All extensions are created here and initialized inside create_app().
"""

import os
import logging
import time
from typing import Optional, Any

from flask import Flask, current_app
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail
from flask_caching import Cache
from flask_compress import Compress
from flask_talisman import Talisman

import redis

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────
# Core Extensions (UNINITIALIZED)
# ────────────────────────────────────────────────

socketio = SocketIO(
    async_mode="threading",
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

jwt = JWTManager()

def init_limiter(app: Flask) -> Limiter:
    if not app.redis_client:
        raise RuntimeError("Redis is required for rate limiting in production")

    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=app.config["REDIS_URL"],
        strategy="fixed-window",
        default_limits=["200 per day", "50 per hour"]
    )

    limiter.init_app(app)
    return limiter

cors = CORS()
migrate = Migrate()
mail = Mail()

cache = Cache(config={
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
})

compress = Compress()
talisman = Talisman()

# ────────────────────────────────────────────────
# Redis (single global reference)
# ────────────────────────────────────────────────

redis_client: Optional[redis.Redis] = None


def init_redis(app: Flask) -> None:
    """
    Initialize Redis once.
    Graceful fallback if unavailable.
    """
    global redis_client

    redis_url = (
        app.config.get("REDIS_URL")
        or os.getenv("REDIS_URL")
        or "redis://localhost:6379/0"
    )

    try:
        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            max_connections=20,
        )

        client.ping()

        redis_client = client
        app.redis_client = client

        logger.info(f"Redis connected successfully: {redis_url}")

    except Exception as e:
        redis_client = None
        app.redis_client = None
        logger.warning("Redis unavailable — rate limiting & pub/sub disabled")


# ────────────────────────────────────────────────
# Safe Redis Wrapper
# ────────────────────────────────────────────────

def safe_redis_call(method_name: str, *args, default: Any = None) -> Any:
    client = getattr(current_app, "redis_client", None)

    if not client:
        return default

    try:
        method = getattr(client, method_name)
        return method(*args)
    except Exception:
        return default


# ────────────────────────────────────────────────
# Logging Setup
# ────────────────────────────────────────────────

def setup_logging(app: Flask) -> None:
    log_level = logging.DEBUG if app.debug else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[logging.StreamHandler()],
    )

    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("socketio").setLevel(logging.WARNING)
    logging.getLogger("engineio").setLevel(logging.WARNING)

    logger.info(f"Logging configured at level: {logging.getLevelName(log_level)}")