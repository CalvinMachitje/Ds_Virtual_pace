from flask import Blueprint
from auth.routes import bp as routes_bp
from auth.oauth import bp as oauth_bp
from auth.twofa import bp as twofa_bp
from auth.admin import bp as admin_bp

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Register sub-blueprints
bp.register_blueprint(routes_bp)
bp.register_blueprint(oauth_bp)
bp.register_blueprint(twofa_bp)
bp.register_blueprint(admin_bp)

# Log registration for debugging
import logging
logger = logging.getLogger(__name__)
logger.info("Auth blueprint initialized with sub-blueprints: routes, oauth, twofa, admin")