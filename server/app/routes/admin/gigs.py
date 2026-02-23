# server/app/routes/admin/gigs.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_gigs", __name__, url_prefix="/admin/gigs")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_gigs():
    try:
        gigs = supabase.client.table("gigs").select("id, title, description, price, category, seller_id, created_at, status").execute().data or []
        return jsonify(gigs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/<gig_id>/status", methods=["PATCH"])
@admin_required
def update_gig_status(gig_id):
    try:
        data = request.get_json()
        new_status = data.get("status")
        if not new_status:
            return jsonify({"error": "Status required"}), 400

        updated = supabase.client.table("gigs").update({"status": new_status}).eq("id", gig_id).execute()
        if not updated.data:
            return jsonify({"error": "Update failed"}), 400

        return jsonify(updated.data[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500