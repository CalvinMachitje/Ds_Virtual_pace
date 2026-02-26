# app/routes/admin.py
from flask import Blueprint, app, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import socketio
from app.services.supabase_service import supabase
from app.utils.decorators import admin_required
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import uuid
import logging
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

logger = logging.getLogger(__name__)

# Rate limiter – assumes Limiter is initialized in __init__.py with Redis
limiter = Limiter(key_func=get_remote_address)

# =============================================================================
# HELPERS
# =============================================================================

def parse_pagination() -> Dict[str, int]:
    """Extract safe pagination params"""
    try:
        page = max(int(request.args.get("page", 1)), 1)
        per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    except (TypeError, ValueError):
        page, per_page = 1, 20
    return {"page": page, "per_page": per_page}


def build_query_with_filters(
    table: str,
    filters: Dict[str, Any],
    order_by: str = "created_at"
):
    """Build paginated & filtered Supabase query"""
    query = supabase.table(table).select("*")

    for key, value in filters.items():
        if value is not None:
            if isinstance(value, bool):
                query = query.eq(key, value)
            elif isinstance(value, str):
                query = query.ilike(key, f"%{value}%")
            else:
                query = query.eq(key, value)

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    from_idx = (page - 1) * per_page
    to_idx = from_idx + per_page - 1

    # Keep your existing hard-coded desc=True (newest first)
    query = query.range(from_idx, to_idx).order(order_by, desc=True)

    # Count query for total
    count_query = supabase.table(table).select("count", count="exact")
    for key, value in filters.items():
        if value is not None:
            count_query = count_query.eq(key, value)

    count_result = count_query.execute()
    # Safe count access (handles older/newer supabase-py versions)
    total = count_result.count if hasattr(count_result, "count") else 0

    return query, {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": (total + per_page - 1) // per_page if per_page else 1,
        "has_more": (page * per_page) < total
    }

# =============================================================================
# Helper: Modern supabase response handler
# =============================================================================
def handle_supabase_response(response):
    """
    Safe handler for supabase-py v2+ responses.
    Returns data or raises exception.
    """
    if not response:
        raise ValueError("No response from Supabase")

    return response.data or []


def log_admin_action(action: str, target_id: str, details: Dict = None):
    """Log admin actions to audit_logs"""
    try:
        log_entry = {
            "user_id": get_jwt_identity(),
            "action": action,
            "details": details or {},
            "created_at": datetime.utcnow().isoformat()
        }
        supabase.table("audit_logs").insert(log_entry).execute()
    except Exception as e:
        logger.error(f"Audit log failed: {str(e)}")


# =============================================================================
# USERS CRUD
# =============================================================================
@bp.route("/users", methods=["GET"])
@jwt_required()
@admin_required
@limiter.limit("50 per minute")
def list_users():
    try:
        filters = {
            "role": request.args.get("role"),
            "banned": request.args.get("banned", "").lower() == "true" if request.args.get("banned") else None,
            "is_verified": request.args.get("verified", "").lower() == "true" if request.args.get("verified") else None
        }

        # Build query with filters & pagination
        query, page_info = build_query_with_filters(
            table="profiles",
            filters=filters,
            order_by="created_at"
        )

        # Select only existing columns + evidence_url (now safe)
        query, page_info = build_query_with_filters(
            table="profiles",
            filters=filters,
            order_by="created_at"
        )

        users_res = query.execute()
        users = users_res.data or []

        return jsonify({
            "users": users,
            "total": page_info["total"],
            "page": page_info["page"],
            "per_page": page_info["per_page"],
            "total_pages": page_info["total_pages"]
        }), 200

    except Exception as e:
        logger.error(f"List users failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch users"}), 500

@bp.route("/users/<user_id>", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("15 per minute")
def update_user(user_id: str):
    data = request.get_json(silent=True) or {}
    action = data.get("action")

    if action not in ["ban", "unban", "verify", "unverify"]:
        return jsonify({"error": "Invalid action"}), 400

    field = "banned" if action in ["ban", "unban"] else "is_verified"
    value = True if action in ["ban", "verify"] else False

    try:
        supabase.table("profiles")\
            .update({field: value, "updated_at": "now()"})\
            .eq("id", user_id)\
            .execute()

        logger.info(f"Admin {action} user {user_id}")
        return jsonify({"success": True, "message": f"{action} applied"}), 200

    except Exception as e:
        logger.error(f"User update failed {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Update failed"}), 500


@bp.route("/users/<user_id>", methods=["DELETE"])
@jwt_required()
@admin_required
@limiter.limit("5 per minute")
def delete_user(user_id: str):
    try:
        current_user_id = get_jwt_identity()
        if current_user_id == user_id:
            return jsonify({"error": "Cannot delete your own account"}), 403

        resp = supabase.table("profiles").delete().eq("id", user_id).execute()
        deleted = handle_supabase_response(resp, single=True)

        if not deleted:
            return jsonify({"error": "User not found"}), 404

        log_admin_action(
            action="delete_user",
            target_id=user_id,
            details={"deleted_by": current_user_id}
        )

        return jsonify({"message": "User deleted"}), 200

    except Exception as e:
        logger.error(f"User delete failed (user_id: {user_id})", exc_info=e)
        return jsonify({"error": "Delete failed"}), 500


# =============================================================================
# BULK USER ACTIONS (used by UsersAdmin.tsx)
# =============================================================================
@bp.route("/users/bulk", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("10 per minute")
def bulk_user_update():
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    user_ids = data.get("userIds", [])

    if action not in ["ban", "unban", "verify", "unverify"]:
        return jsonify({"error": "Invalid action"}), 400
    if not user_ids:
        return jsonify({"error": "No users selected"}), 400

    field = "banned" if action in ["ban", "unban"] else "is_verified"
    value = True if action in ["ban", "verify"] else False

    try:
        supabase.table("profiles")\
            .update({field: value, "updated_at": "now()"})\
            .in_("id", user_ids)\
            .execute()

        logger.info(f"Bulk {action} on {len(user_ids)} users")
        return jsonify({"success": True, "message": f"{action} applied"}), 200

    except Exception as e:
        logger.error(f"Bulk {action} failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Bulk action failed"}), 500

# =============================================================================
# SUPPORT TICKETS
# =============================================================================

@bp.route("/tickets", methods=["GET"])
@jwt_required()
@admin_required
@limiter.limit("50 per minute")
def list_tickets():
    try:
        filters = {
            "status": request.args.get("status"),
            "user_id": request.args.get("user_id"),
            "priority": request.args.get("priority")
        }
        query, page_info = build_query_with_filters("support_tickets", filters, order_by="created_at")
        tickets = handle_supabase_response(query.execute()) or []

        return jsonify({"tickets": tickets, **page_info}), 200

    except Exception as e:
        logger.error("Failed to list tickets", exc_info=e)
        return jsonify({"error": "Failed to fetch tickets"}), 500


@bp.route("/tickets", methods=["POST"])
@jwt_required()
@admin_required
@limiter.limit("20 per minute")
def create_ticket():
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    required = ["user_id", "subject", "description"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        ticket = {
            "user_id": data["user_id"],
            "subject": data["subject"].strip(),
            "description": data["description"].strip(),
            "status": data.get("status", "open"),
            "priority": data.get("priority", "medium"),
            "assigned_to": data.get("assigned_to"),
            "created_at": "now()",
            "status_history": [{
                "status": "open",
                "changed_at": datetime.utcnow().isoformat(),
                "changed_by": "admin",
                "reason": data.get("initial_reason", "Created by admin")
            }]
        }

        resp = supabase.table("support_tickets").insert(ticket).execute()
        result = handle_supabase_response(resp, single=True)
        if not result:
            return jsonify({"error": "Failed to create ticket"}), 500

        log_admin_action(
            action="create_ticket",
            target_id=result[0]["id"],
            details={"user_id": data["user_id"], "subject": data["subject"]}
        )

        return jsonify(result[0]), 201

    except Exception as e:
        logger.error("Ticket creation failed", exc_info=e)
        return jsonify({"error": "Creation failed"}), 500


@bp.route("/tickets/<ticket_id>", methods=["GET"])
@jwt_required()
@admin_required
def get_ticket(ticket_id: str):
    try:
        resp = supabase.table("support_tickets").select("*").eq("id", ticket_id).maybe_single().execute()
        ticket = handle_supabase_response(resp, single=True)
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(ticket), 200

    except Exception as e:
        logger.error(f"Get ticket failed (ticket_id: {ticket_id})", exc_info=e)
        return jsonify({"error": "Failed to fetch ticket"}), 500


@bp.route("/tickets/<ticket_id>", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("30 per minute")
def update_ticket(ticket_id: str):
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No update data provided"}), 400

    try:
        resp = supabase.table("support_tickets")\
            .select("status, status_history")\
            .eq("id", ticket_id)\
            .maybe_single().execute()

        current = handle_supabase_response(resp, single=True)
        if not current:
            return jsonify({"error": "Ticket not found"}), 404

        update_data: Dict[str, Any] = {}
        status_history = current.get("status_history", []) or []

        # Status change with history
        if "status" in data and data["status"] != current["status"]:
            reason = data.get("reason", "").strip()
            if not reason:
                return jsonify({"error": "Reason required when changing status"}), 400

            update_data["status"] = data["status"]
            status_history.append({
                "status": data["status"],
                "changed_at": datetime.utcnow().isoformat(),
                "changed_by": "admin",
                "reason": reason
            })
            update_data["status_history"] = status_history

        # Other updatable fields
        allowed = ["subject", "description", "priority", "assigned_to", "resolution_notes"]
        for field in allowed:
            if field in data:
                update_data[field] = data[field]

        if update_data:
            update_data["updated_at"] = "now()"
            resp = supabase.table("support_tickets")\
                .update(update_data)\
                .eq("id", ticket_id)\
                .execute()

            updated = handle_supabase_response(resp, single=True)
            if not updated:
                return jsonify({"error": "Update failed"}), 400

            log_admin_action(
                action="update_ticket",
                target_id=ticket_id,
                details={"changed_fields": list(update_data.keys())}
            )

            return jsonify(updated[0]), 200

        return jsonify({"message": "No changes applied"}), 200

    except Exception as e:
        logger.error(f"Ticket update failed (ticket_id: {ticket_id})", exc_info=e)
        return jsonify({"error": "Update failed"}), 500


@bp.route("/tickets/<ticket_id>", methods=["DELETE"])
@jwt_required()
@admin_required
@limiter.limit("5 per minute")
def delete_ticket(ticket_id: str):
    try:
        resp = supabase.table("support_tickets").delete().eq("id", ticket_id).execute()
        deleted = handle_supabase_response(resp, single=True)
        if not deleted:
            return jsonify({"error": "Ticket not found"}), 404

        log_admin_action(
            action="delete_ticket",
            target_id=ticket_id,
            details={"deleted_by": get_jwt_identity()}
        )

        return jsonify({"message": "Ticket deleted"}), 200

    except Exception as e:
        logger.error(f"Ticket delete failed (ticket_id: {ticket_id})", exc_info=e)
        return jsonify({"error": "Delete failed"}), 500


# =============================================================================
# VERIFICATIONS
# =============================================================================

@bp.route("/verifications", methods=["GET"])
@jwt_required()
@admin_required
@limiter.limit("30 per minute")
def list_verifications():
    try:
        filters = {
            "status": request.args.get("status"),
            "seller_id": request.args.get("seller_id")
        }
        query, page_info = build_query_with_filters("verifications", filters, order_by="submitted_at")
        verifs = handle_supabase_response(query.execute()) or []

        return jsonify({"verifications": verifs, **page_info}), 200

    except Exception as e:
        logger.error("List verifications failed", exc_info=e)
        return jsonify({"error": "Failed to fetch verifications"}), 500


@bp.route("/verifications/<verification_id>", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("20 per minute")
def update_verification(verification_id: str):
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    allowed = ["status", "rejection_reason", "reviewed_by"]
    update_data = {k: v for k, v in data.items() if k in allowed}

    if not update_data:
        return jsonify({"error": "No valid fields"}), 400

    try:
        # Validate status
        if "status" in update_data and update_data["status"] not in ["approved", "rejected", "pending"]:
            return jsonify({"error": "Invalid status"}), 400

        update_data["reviewed_at"] = "now()"
        update_data["reviewed_by"] = get_jwt_identity()

        resp = supabase.table("verifications")\
            .update(update_data)\
            .eq("id", verification_id)\
            .execute()

        updated = handle_supabase_response(resp, single=True)
        if not updated:
            return jsonify({"error": "Verification not found"}), 404

        # If approved, update seller profile
        if update_data.get("status") == "approved":
            seller_id = updated["seller_id"]
            supabase.table("profiles")\
                .update({"is_verified": True, "updated_at": "now()"})\
                .eq("id", seller_id)\
                .execute()

        log_admin_action(
            action="update_verification",
            target_id=verification_id,
            details={"status": update_data.get("status"), "reason": update_data.get("rejection_reason")}
        )

        return jsonify(updated), 200

    except Exception as e:
        logger.error(f"Verification update failed (id: {verification_id})", exc_info=e)
        return jsonify({"error": "Update failed"}), 500


# =============================================================================
# Manage Gigs
# =============================================================================
@bp.route("/gigs", methods=["GET"])
@jwt_required()
@admin_required
def list_gigs():
    try:
        query = supabase.table("gigs")\
            .select("*, profiles!seller_id (full_name, email)")\
            .order("created_at", desc=True)

        # Optional filters (add more as needed)
        status = request.args.get("status")
        if status:
            query = query.eq("status", status)

        gigs = handle_supabase_response(query.execute())

        return jsonify(gigs), 200

    except Exception as e:
        logger.error(f"List gigs failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to load gigs"}), 500


@bp.route("/gigs/<gig_id>/status", methods=["PATCH"])
@jwt_required()
@admin_required
def update_gig_status(gig_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if new_status not in ["active", "rejected"]:
        return jsonify({"error": "Invalid status"}), 400

    try:
        updated = supabase.table("gigs")\
            .update({"status": new_status, "updated_at": "now()"})\
            .eq("id", gig_id)\
            .execute()

        if not updated.data:
            return jsonify({"error": "Gig not found"}), 404

        logger.info(f"Admin updated gig {gig_id} to {new_status}")
        return jsonify({"message": f"Gig status updated to {new_status}"}), 200

    except Exception as e:
        logger.error(f"Update gig status failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to update gig"}), 500


# =============================================================================
# BOOKINGS – Admin endpoints
# =============================================================================
@bp.route("/bookings", methods=["GET"])
@jwt_required()
@admin_required
@limiter.limit("30 per minute")
def list_bookings():
    try:
        filters = {
            "status": request.args.get("status"),
            "buyer_id": request.args.get("buyer_id"),
            "seller_id": request.args.get("seller_id")
        }

        # Correct call – no desc= argument
        query, page_info = build_query_with_filters(
            table="bookings",
            filters=filters,
            order_by="created_at",
            # page and per_page are read from request.args inside the function
        )

        bookings = handle_supabase_response(query.execute()) or []

        return jsonify({"bookings": bookings, **page_info}), 200

    except Exception as e:
        logger.error("List bookings failed", exc_info=True)
        # Always return array shape
        return jsonify({
            "bookings": [],
            "total": 0,
            "page": 1,
            "per_page": 20,
            "total_pages": 1,
            "has_more": False
        }), 200

@bp.route("/bookings/<booking_id>", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("15 per minute")
def update_booking(booking_id: str):
    """
    PATCH /api/admin/bookings/<booking_id>
    Body: { "status": "...", "price": 123, ... }
    """
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    
    # Allowed fields (you can expand this list)
    allowed = ["status", "price", "service", "cancel_reason", "requirements", "notes"]
    update_data = {k: v for k, v in data.items() if k in allowed and v is not None}

    if not update_data:
        return jsonify({"error": "No valid fields provided for update"}), 400

    try:
        # Update with timestamp
        resp = supabase.table("bookings")\
            .update({**update_data, "updated_at": "now()"})\
            .eq("id", booking_id)\
            .execute()

        updated = handle_supabase_response(resp, single=True)
        if not updated:
            return jsonify({"error": "Booking not found or update failed"}), 404

        # Log admin action
        log_admin_action(
            action="update_booking",
            target_id=booking_id,
            details={
                "changed_fields": list(update_data.keys()),
                "new_values": update_data
            }
        )

        # Optional: invalidate cache if you use any
        # queryClient.invalidateQueries(["admin-bookings"]) → frontend side

        return jsonify(updated), 200

    except Exception as e:
        logger.error(f"Booking update failed (booking_id: {booking_id})", exc_info=True)
        return jsonify({
            "error": "Update failed",
            "detail": str(e) if app.debug else None
        }), 500

@bp.route("/bookings/<booking_id>/status", methods=["PATCH"])
@jwt_required()
@admin_required
def update_booking_status(booking_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if not new_status or new_status not in ["pending", "active", "completed", "cancelled"]:
        return jsonify({"error": "Invalid status"}), 400

    try:
        updated = supabase.table("bookings")\
            .update({"status": new_status, "updated_at": "now()"})\
            .eq("id", booking_id)\
            .execute()

        if not updated.data:
            return jsonify({
                "error": "Booking not found",
                "booking_id": booking_id,
                "message": "The booking may have been deleted or never existed."
            }), 404

        logger.info(f"Admin updated booking {booking_id} to {new_status}")

        return jsonify({
            "message": f"Booking status updated to {new_status}",
            "booking": updated.data[0]
        }), 200

    except Exception as e:
        logger.error(f"Update booking status failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Update failed"}), 500

# =============================================================================
# PAYMENTS
# =============================================================================

@bp.route("/payments", methods=["GET"])
@jwt_required()
@admin_required
@limiter.limit("20 per minute")
def list_payments():
    try:
        filters = {"status": request.args.get("status")}
        query, page_info = build_query_with_filters("payments", filters, order_by="created_at")
        payments = handle_supabase_response(query.execute()) or []

        return jsonify({"payments": payments, **page_info}), 200

    except Exception as e:
        logger.error("List payments failed", exc_info=e)
        return jsonify({"error": "Failed to fetch payments"}), 500


@bp.route("/payments/<payment_id>/refund", methods=["PATCH"])
@jwt_required()
@admin_required
@limiter.limit("5 per minute")
def refund_payment(payment_id: str):
    try:
        resp = supabase.table("payments")\
            .update({"status": "refunded", "updated_at": "now()"})\
            .eq("id", payment_id)\
            .execute()

        updated = handle_supabase_response(resp, single=True)
        if not updated:
            return jsonify({"error": "Payment not found"}), 404

        log_admin_action(
            action="refund_payment",
            target_id=payment_id,
            details={"refunded_by": get_jwt_identity()}
        )

        return jsonify(updated), 200

    except Exception as e:
        logger.error(f"Refund failed (payment_id: {payment_id})", exc_info=e)
        return jsonify({"error": "Refund failed"}), 500


# =============================================================================
# ANALYTICS / DASHBOARD
# =============================================================================
@bp.route("/dashboard", methods=["GET"])
@jwt_required()
@admin_required
def admin_dashboard():
    try:
        total_users = supabase.table("profiles").select("count", count="exact").execute().count or 0
        pending_verifs = supabase.table("verifications").select("count", count="exact").eq("status", "pending").execute().count or 0
        open_tickets = supabase.table("support_tickets").select("count", count="exact").eq("status", "open").execute().count or 0
        active_gigs = supabase.table("gigs").select("count", count="exact").eq("status", "published").execute().count or 0

        return jsonify({
            "total_users": total_users,
            "pending_verifications": pending_verifs,
            "open_tickets": open_tickets,
            "active_gigs": active_gigs
        }), 200

    except Exception as e:
        logger.error(f"Dashboard failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to load dashboard"}), 500
    
# =============================================================================
# JOB REQUESTS – Admin endpoints
# =============================================================================

@bp.route("/job-requests", methods=["GET"])
@jwt_required()
@admin_required
def list_job_requests():
    """
    GET /api/admin/job-requests?status=pending
    List job requests with buyer details
    """
    status = request.args.get("status", "pending")
    try:
        reqs = supabase.table("job_requests")\
            .select("*, profiles!buyer_id (full_name, email, phone)")\
            .eq("status", status)\
            .order("created_at", desc=True)\
            .execute()

        reqs_data = handle_supabase_response(reqs)

        formatted = []
        for r in reqs_data:
            buyer = r.pop("profiles!buyer_id", {}) or {}
            formatted.append({
                **r,
                "buyer": {
                    "name": buyer.get("full_name", "Unknown"),
                    "email": buyer.get("email"),
                    "phone": buyer.get("phone")
                }
            })

        return jsonify(formatted), 200

    except Exception as e:
        logger.error(f"List requests failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to load requests"}), 500


@bp.route("/job-requests/<request_id>", methods=["GET"])
@jwt_required()
@admin_required
def get_job_request(request_id):
    """
    GET /api/admin/job-requests/:request_id
    Get full details of one job request
    """
    try:
        req = supabase.table("job_requests")\
            .select("""
                *,
                profiles!buyer_id (full_name, email, phone, avatar_url)
            """)\
            .eq("id", request_id)\
            .maybe_single()\
            .execute()

        req_data = handle_supabase_response(req)

        if not req_data:
            return jsonify({"error": "Job request not found"}), 404

        buyer = req_data.pop("profiles!buyer_id", {}) or {}
        response = {
            **req_data,
            "buyer": {
                "name": buyer.get("full_name", "Unknown"),
                "email": buyer.get("email"),
                "phone": buyer.get("phone"),
                "avatar_url": buyer.get("avatar_url")
            }
        }

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Failed to get job request {request_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch job request"}), 500


@bp.route("/job-requests/<request_id>/assign", methods=["PATCH"])
@jwt_required()
@admin_required
def assign_seller_to_job_request(request_id):
    data = request.get_json(silent=True) or {}
    seller_ids = data.get("seller_ids", [])  # now expects array
    notes = data.get("notes", "").strip()

    if not seller_ids or not isinstance(seller_ids, list):
        return jsonify({"error": "seller_ids must be a non-empty list"}), 400

    try:
        # Get request
        req = supabase.table("job_requests")\
            .select("id, status, category, buyer_id")\
            .eq("id", request_id)\
            .maybe_single()\
            .execute().data

        if not req:
            return jsonify({"error": "Job request not found"}), 404

        if req["status"] != "pending":
            return jsonify({"error": f"Request is already {req['status']}"}), 400

        assigned = []
        for seller_id in seller_ids:
            # Validate seller
            seller = supabase.table("profiles")\
                .select("id, role, employee_category, is_available")\
                .eq("id", seller_id)\
                .eq("role", "seller")\
                .maybe_single()\
                .execute().data

            if not seller:
                continue  # skip invalid

            if seller["employee_category"] != req["category"]:
                continue

            if not seller["is_available"]:
                continue

            # Assign
            update = supabase.table("job_requests")\
                .update({
                    "assigned_seller_id": seller_id,  # if single assign → last one wins, or change schema
                    "status": "assigned",
                    "updated_at": "now()"
                })\
                .eq("id", request_id)\
                .execute()

            if update.data:
                assigned.append(seller_id)

            # Notify seller
            socketio.emit(
                "new_job_assignment",
                {
                    "request_id": request_id,
                    "buyer_id": req["buyer_id"],
                    "category": req["category"],
                    "title": req["title"],
                    "notes": notes
                },
                room=seller_id
            )

        if not assigned:
            return jsonify({"error": "No valid sellers could be assigned"}), 400

        return jsonify({
            "message": f"Assigned {len(assigned)} seller(s)",
            "assigned_seller_ids": assigned
        }), 200

    except Exception as e:
        logger.error(f"Assign failed for {request_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to assign seller(s)"}), 500


@bp.route("/job-requests/<request_id>/status", methods=["PATCH"])
@jwt_required()
@admin_required
def update_job_request_status(request_id):
    """
    PATCH /api/admin/job-requests/:request_id/status
    Body: { "status": "cancelled|rejected", "reason": "optional string" }
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    reason = data.get("reason", "").strip()

    valid_statuses = ["cancelled", "rejected"]
    if not new_status or new_status not in valid_statuses:
        return jsonify({"error": f"Valid statuses: {', '.join(valid_statuses)}"}), 400

    try:
        updated = supabase.table("job_requests")\
            .update({
                "status": new_status,
                "updated_at": "now()"
            })\
            .eq("id", request_id)\
            .execute()

        if not updated.data:
            return jsonify({"error": "Job request not found"}), 404

        logger.info(f"Admin updated job request {request_id} to {new_status} (reason: {reason})")

        return jsonify({
            "message": f"Request marked as {new_status}",
            "request_id": request_id,
            "reason": reason
        }), 200

    except Exception as e:
        logger.error(f"Status update failed for request {request_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Status update failed"}), 500


@bp.route("/job-requests/<request_id>/offers", methods=["POST"])
@jwt_required()
@admin_required
def send_offer_to_sellers(request_id):
    """
    POST /api/admin/job-requests/<request_id>/offers
    Body: {
      "seller_ids": ["uuid1", "uuid2"],
      "offered_price": 500,
      "offered_start": "2026-03-01T10:00:00Z",
      "message": "Please review and accept if available"
    }
    """
    data = request.get_json(silent=True) or {}
    seller_ids = data.get("seller_ids", [])
    price = data.get("offered_price")
    start_time = data.get("offered_start")
    message = data.get("message", "")

    if not seller_ids or not isinstance(seller_ids, list):
        return jsonify({"error": "seller_ids must be a non-empty list of UUIDs"}), 400

    try:
        # Validate request
        req = supabase.table("job_requests")\
            .select("id, status, category, buyer_id, title")\
            .eq("id", request_id)\
            .maybe_single()\
            .execute()

        req_data = handle_supabase_response(req)

        if not req_data:
            return jsonify({"error": "Job request not found"}), 404

        if req_data["status"] not in ["pending", "in_review"]:
            return jsonify({"error": f"Request already {req_data['status']}"}), 400

        # Validate sellers
        valid_sellers = []
        for seller_id in seller_ids:
            seller = supabase.table("profiles")\
                .select("id, role, employee_category, is_available")\
                .eq("id", seller_id)\
                .eq("role", "seller")\
                .maybe_single()\
                .execute()

            seller_data = handle_supabase_response(seller)

            if not seller_data or seller_data["employee_category"] != req_data["category"]:
                continue

            if not seller_data["is_available"]:
                continue

            valid_sellers.append(seller_id)

        if not valid_sellers:
            return jsonify({"error": "No valid/available sellers found in this category"}), 400

        # Create offers
        offers = []
        for seller_id in valid_sellers:
            offer = {
                "request_id": request_id,
                "seller_id": seller_id,
                "admin_id": get_jwt_identity(),
                "offered_price": price,
                "offered_start": start_time,
                "message": message,
                "status": "pending",
                "created_at": "now()",
                "updated_at": "now()"
            }
            res = supabase.table("job_offers").insert(offer).execute()
            offer_data = handle_supabase_response(res)
            if offer_data:
                offers.append(offer_data[0])

        # Update request status
        supabase.table("job_requests")\
            .update({"status": "offered", "updated_at": "now()"})\
            .eq("id", request_id)\
            .execute()

        # Notify sellers
        for seller_id in valid_sellers:
            socketio.emit(
                "new_job_offer",
                {
                    "request_id": request_id,
                    "title": req_data["title"],
                    "category": req_data["category"],
                    "offered_price": price,
                    "message": message
                },
                room=seller_id
            )

        return jsonify({
            "message": f"Offer sent to {len(offers)} seller(s)",
            "offers": offers
        }), 201

    except Exception as e:
        logger.error(f"Send offer failed for request {request_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to send offer"}), 500
    
@bp.route("/available-sellers", methods=["GET"])
@jwt_required()
@admin_required
def get_available_sellers():
    category = request.args.get("category")
    if not category:
        return jsonify({"error": "category required"}), 400

    try:
        # Get sellers who have at least one gig in this category + are available
        query = supabase.table("profiles")\
            .select("""
                id, full_name, avatar_url, bio, rating, is_available, employee_category,
                gigs!seller_id (id, title, price, status)
            """)\
            .eq("role", "seller")\
            .eq("is_available", True)\
            .eq("gigs.category", category)\
            .order("rating", desc=True)

        result = query.execute().data or []

        # Format: add gig_count and sample gigs
        formatted = []
        for seller in result:
            gigs = seller.pop("gigs", []) or []
            formatted.append({
                **seller,
                "gig_count": len([g for g in gigs if g["status"] == "published"]),
                "sample_gigs": [g["title"] for g in gigs[:2]]  # first 2 titles
            })

        return jsonify(formatted), 200

    except Exception as e:
        logger.error(f"Available sellers failed: {str(e)}")
        return jsonify({"error": "Failed to load sellers"}), 500

@bp.route("/debug/supabase", methods=["GET"])
def debug_supabase():
    status = supabase.check_connection()
    return jsonify(status), 200