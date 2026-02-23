# server/app/routes/admin/support.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_support", __name__, url_prefix="/admin/support")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_tickets():
    try:
        tickets = supabase.client.table("support_tickets").select("*").execute().data or []
        return jsonify(tickets), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/<ticket_id>/close", methods=["PATCH"])
@admin_required
def close_ticket(ticket_id):
    try:
        updated = supabase.client.table("support_tickets").update({"status": "closed"}).eq("id", ticket_id).execute()
        if not updated.data:
            return jsonify({"error": "Close failed"}), 400
        return jsonify(updated.data[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500