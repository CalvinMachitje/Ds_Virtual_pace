# server/app/routes/admin/logs.py
from flask import Blueprint, jsonify
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_logs", __name__, url_prefix="/admin/logs")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_logs():
    try:
        logs = (
            supabase.client
            .table("audit_logs")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data or []
        )
        return jsonify(logs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500