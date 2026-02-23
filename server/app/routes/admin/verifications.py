# app/routes/admin/verifications.py
from functools import wraps
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase

bp = Blueprint("admin_verifications", __name__, url_prefix="/admin/verifications")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        profile = supabase.table("profiles")\
            .select("role")\
            .eq("id", user_id)\
            .maybe_single().execute()

        if not profile.data or profile.data.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403

        return f(*args, **kwargs)
    return decorated


@bp.route("/", methods=["GET"])
@admin_required
def list_pending_verifications():
    """
    List all pending verifications with seller name/email
    """
    try:
        res = supabase.table("verifications")\
            .select("""
                id,
                seller_id,
                type,
                status,
                submitted_at,
                evidence_urls,
                rejection_reason,
                profiles!seller_id (full_name, email)
            """)\
            .eq("status", "pending")\
            .order("submitted_at", desc=True)\
            .execute()

        if not res.data:
            return jsonify([]), 200

        # Flatten nested profiles
        result = []
        for v in res.data:
            seller = v.pop("profiles", {}) or {}
            result.append({
                **v,
                "seller_full_name": seller.get("full_name"),
                "seller_email": seller.get("email")
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch verifications: {str(e)}"}), 500


@bp.route("/<ver_id>/approve", methods=["PATCH"])
@admin_required
def approve_verification(ver_id):
    """
    Approve a verification request and mark seller as verified
    """
    try:
        # Get verification to verify it exists and get seller_id
        ver = supabase.table("verifications")\
            .select("id, seller_id, status")\
            .eq("id", ver_id)\
            .maybe_single().execute()

        if not ver.data:
            return jsonify({"error": "Verification request not found"}), 404

        if ver.data["status"] != "pending":
            return jsonify({"error": f"Verification already {ver.data['status']}"}), 400

        seller_id = ver.data["seller_id"]

        # 1. Approve verification
        supabase.table("verifications")\
            .update({"status": "approved"})\
            .eq("id", ver_id)\
            .execute()

        # 2. Mark seller as verified
        supabase.table("profiles")\
            .update({"is_verified": True, "updated_at": "now()"})\
            .eq("id", seller_id)\
            .execute()

        return jsonify({
            "message": "Verification approved",
            "seller_id": seller_id
        }), 200

    except Exception as e:
        return jsonify({"error": f"Approval failed: {str(e)}"}), 500


@bp.route("/<ver_id>/reject", methods=["PATCH"])
@admin_required
def reject_verification(ver_id):
    """
    Reject a verification request (with optional reason)
    """
    data = request.get_json(silent=True) or {}
    rejection_reason = data.get("rejection_reason", "").strip()

    try:
        ver = supabase.table("verifications")\
            .select("id, status")\
            .eq("id", ver_id)\
            .maybe_single().execute()

        if not ver.data:
            return jsonify({"error": "Verification request not found"}), 404

        if ver.data["status"] != "pending":
            return jsonify({"error": f"Verification already {ver.data['status']}"}), 400

        update_data = {"status": "rejected"}
        if rejection_reason:
            update_data["rejection_reason"] = rejection_reason

        supabase.table("verifications")\
            .update(update_data)\
            .eq("id", ver_id)\
            .execute()

        return jsonify({
            "message": "Verification rejected",
            "reason_provided": bool(rejection_reason)
        }), 200

    except Exception as e:
        return jsonify({"error": f"Rejection failed: {str(e)}"}), 500