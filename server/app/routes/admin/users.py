# server/app/routes/admin/users.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint("admin_users", __name__, url_prefix="/admin/users")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder - later replace with JWT/role check
        return f(*args, **kwargs)
    return decorated

@bp.route("/", methods=["GET"])
@admin_required
def list_users():
    try:
        # Fetch profiles + optional evidence join for pending sellers
        profiles = supabase.client.table("profiles").select("*").execute().data or []

        # For pending sellers, fetch latest pending verification evidence
        seller_ids = [p["id"] for p in profiles if p["role"] == "seller" and not p["is_verified"]]
        evidence_map = {}

        if seller_ids:
            verifications = (
                supabase.client
                .table("verifications")
                .select("seller_id, evidence_url")
                .in_("seller_id", seller_ids)
                .eq("status", "pending")
                .order("submitted_at", desc=True)
                .execute()
                .data or []
            )
            for v in verifications:
                if v["seller_id"] not in evidence_map:
                    evidence_map[v["seller_id"]] = v["evidence_url"]

        # Merge evidence_url into profiles
        users = []
        for p in profiles:
            user = {**p}
            if p["role"] == "seller" and not p["is_verified"]:
                user["evidence_url"] = evidence_map.get(p["id"])
            users.append(user)

        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/<user_id>", methods=["PATCH"])
@admin_required
def update_user(user_id):
    try:
        data = request.get_json()
        action = data.get("action")

        if not action:
            return jsonify({"error": "action required"}), 400

        update_data = {}
        if action == "ban":
            update_data["banned"] = True
        elif action == "unban":
            update_data["banned"] = False
        elif action == "verify":
            update_data["is_verified"] = True
        elif action == "unverify":
            update_data["is_verified"] = False
        else:
            return jsonify({"error": "Invalid action"}), 400

        updated = supabase.client.table("profiles").update(update_data).eq("id", user_id).execute()
        if not updated.data:
            return jsonify({"error": "Update failed"}), 400

        return jsonify(updated.data[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/bulk", methods=["PATCH"])
@admin_required
def bulk_update():
    try:
        data = request.get_json()
        action = data.get("action")
        user_ids = data.get("userIds", [])

        if not action or not user_ids:
            return jsonify({"error": "action and userIds required"}), 400

        update_data = {}
        if action == "ban":
            update_data["banned"] = True
        elif action == "unban":
            update_data["banned"] = False
        elif action == "verify":
            update_data["is_verified"] = True
        elif action == "unverify":
            update_data["is_verified"] = False
        else:
            return jsonify({"error": "Invalid action"}), 400

        # Supabase .in_() bulk update
        supabase.client.table("profiles").update(update_data).in_("id", user_ids).execute()

        return jsonify({"message": f"{len(user_ids)} users updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500