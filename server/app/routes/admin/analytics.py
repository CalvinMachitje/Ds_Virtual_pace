# server/app/routes/admin/analytics.py
from flask import Blueprint, jsonify
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint('admin_analytics', __name__, url_prefix='/admin/analytics')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder - replace with JWT check later
        return f(*args, **kwargs)
    return decorated

@bp.route('/', methods=['GET'])
@admin_required
def get_analytics():
    try:
        summary = supabase.get_analytics_summary()
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500