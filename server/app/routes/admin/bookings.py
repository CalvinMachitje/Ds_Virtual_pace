# server/app/routes/admin/bookings.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_bookings", __name__, url_prefix="/admin/bookings")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder - later replace with JWT/role check
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_bookings():
    try:
        bookings = supabase.client.table("bookings").select("*").execute().data or []
        return jsonify(bookings), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/<booking_id>/status", methods=["PATCH"])
@admin_required
def update_booking_status(booking_id):
    try:
        data = request.get_json()
        new_status = data.get("status")
        if not new_status:
            return jsonify({"error": "Status required"}), 400

        updated = supabase.client.table("bookings").update({"status": new_status}).eq("id", booking_id).execute()
        if not updated.data:
            return jsonify({"error": "Update failed"}), 400

        return jsonify(updated.data[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500