# app/routes/support.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
import uuid

bp = Blueprint("support", __name__, url_prefix="/api/support")

# GET /api/support/my-tickets
# Returns ONLY the authenticated user's own tickets
@bp.route("/my-tickets", methods=["GET"])
@jwt_required()
def get_my_tickets():
    user_id = get_jwt_identity()

    try:
        res = supabase.table("support_tickets")\
            .select("""
                id,
                subject,
                description,
                status,
                created_at,
                escalated_note,
                escalated_at,
                resolved_at
            """)\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()

        # ← This line ensures the frontend always gets the expected shape
        return jsonify({"tickets": res.data or []}), 200

    except Exception as e:
        # Also safe on error — prevents frontend crash
        return jsonify({"tickets": [], "error": str(e)}), 500


# GET /api/support/<ticket_id>/thread
# Only returns the ticket + replies if the ticket belongs to the authenticated user
@bp.route("/<ticket_id>/thread", methods=["GET"])
@jwt_required()
def get_ticket_thread(ticket_id):
    user_id = get_jwt_identity()

    try:
        # Fetch ticket and enforce ownership
        ticket_res = supabase.table("support_tickets")\
            .select("id, user_id, subject, description, status, created_at")\
            .eq("id", ticket_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()

        if not ticket_res.data:
            return jsonify({"error": "Ticket not found or you do not have access to it"}), 404

        ticket = ticket_res.data

        # Fetch replies (no ownership filter needed here — replies belong to ticket)
        replies_res = supabase.table("support_replies")\
            .select("""
                id,
                sender_id,
                message,
                created_at,
                is_admin,
                sender:profiles!sender_id (full_name as sender_name)
            """)\
            .eq("ticket_id", ticket_id)\
            .order("created_at", desc=False)\
            .execute()

        return jsonify({
            "ticket": ticket,
            "replies": replies_res.data or []
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to load ticket thread"}), 500


# POST /api/support
# User creates a new support ticket — automatically assigned to current authenticated user
@bp.route("/", methods=["POST"])
@jwt_required()
def create_support_ticket():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Required fields
    if not data or "subject" not in data or "description" not in data:
        return jsonify({"error": "Subject and description are required"}), 400

    subject = data.get("subject", "").strip()
    description = data.get("description", "").strip()

    # Validation
    if not subject:
        return jsonify({"error": "Subject cannot be empty"}), 400
    if len(subject) < 5:
        return jsonify({"error": "Subject must be at least 5 characters"}), 400

    if not description:
        return jsonify({"error": "Description cannot be empty"}), 400
    if len(description) < 20:
        return jsonify({"error": "Description must be at least 20 characters"}), 400

    # Optional fields with defaults
    priority = data.get("priority", "medium")  # low / medium / high
    if priority not in ["low", "medium", "high"]:
        priority = "medium"

    category = data.get("category")  # e.g. "payment", "booking", "technical", "other"

    try:
        ticket = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,                 # enforced: always current authenticated user
            "subject": subject,
            "description": description,
            "status": "open",
            "priority": priority,
            "category": category or None,       # optional
            "created_at": "now()",
            "last_activity": "now()"            # useful for sorting by recent activity
        }

        res = supabase.table("support_tickets").insert(ticket).execute()

        if not res.data:
            return jsonify({"error": "Failed to insert ticket into database"}), 500

        return jsonify({
            "message": "Ticket created successfully",
            "ticket": res.data[0]
        }), 201

    except Exception as e:
        # Provide more helpful message if possible
        error_msg = str(e)
        if "duplicate key" in error_msg.lower():
            error_msg = "Ticket creation failed due to duplicate entry"
        elif "foreign key" in error_msg.lower():
            error_msg = "Invalid user reference"
        else:
            error_msg = f"Database error: {error_msg}"

        return jsonify({"error": error_msg}), 500

# PATCH /api/support/<ticket_id>/user-resolved
# User can only resolve their own open tickets
@bp.route("/<ticket_id>/user-resolved", methods=["PATCH"])
@jwt_required()
def user_mark_resolved(ticket_id):
    user_id = get_jwt_identity()

    try:
        ticket_res = supabase.table("support_tickets")\
            .select("id, user_id, status")\
            .eq("id", ticket_id)\
            .single()\
            .execute()

        if not ticket_res.data:
            return jsonify({"error": "Ticket not found"}), 404

        if ticket_res.data["user_id"] != user_id:
            return jsonify({"error": "You do not have permission to resolve this ticket"}), 403

        if ticket_res.data["status"] != "open":
            return jsonify({"error": "Only open tickets can be resolved by user"}), 400

        res = supabase.table("support_tickets")\
            .update({
                "status": "resolved",
                "resolved_at": "now()",
                "resolved_by": user_id
            })\
            .eq("id", ticket_id)\
            .execute()

        if not res.data:
            return jsonify({"error": "Failed to resolve ticket"}), 500

        return jsonify({"message": "Ticket resolved by user"}), 200

    except Exception as e:
        return jsonify({"error": "Failed to resolve ticket"}), 500