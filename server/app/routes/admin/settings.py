# server/app/routes/admin/settings.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_settings", __name__, url_prefix="/admin/settings")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def get_settings():
    try:
        settings = supabase.client.table("settings").select("*").eq("id", "general").single().execute()
        if not settings.data:
            return jsonify({"service_fee": 10}), 200  # default
        return jsonify(settings.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/", methods=["PATCH"])
@admin_required
def update_settings():
    try:
        data = request.get_json()
        service_fee = data.get("service_fee")

        if service_fee is None:
            return jsonify({"error": "service_fee required"}), 400

        updated = supabase.client.table("settings").upsert({
            "id": "general",
            "service_fee": service_fee,
            "updated_at": "now()"
        }).execute()

        return jsonify(updated.data[0] if updated.data else {"service_fee": service_fee}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500