# server/app/routes/admin/payments.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_payments", __name__, url_prefix="/admin/payments")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_payments():
    try:
        payments = supabase.client.table("payments").select("*").execute().data or []
        return jsonify(payments), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/<payment_id>/refund", methods=["PATCH"])
@admin_required
def refund_payment(payment_id):
    try:
        updated = supabase.client.table("payments").update({"status": "refunded"}).eq("id", payment_id).execute()
        if not updated.data:
            return jsonify({"error": "Refund failed"}), 400
        return jsonify(updated.data[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500