# app/routes/buyer.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import os
import uuid

bp = Blueprint("buyer", __name__, url_prefix="/api/buyer")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB

# Simple in-memory rate limit (for demo) — use Flask-Limiter in production
avatar_upload_attempts = {}  # {user_id: last_upload_time}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ────────────────────────────────────────────────
# GET /api/buyer/dashboard
# Trending categories + featured VAs (public + authenticated)
# ────────────────────────────────────────────────
@bp.route("/dashboard", methods=["GET"])
@jwt_required(optional=True)
def buyer_dashboard():
    try:
        # Trending categories (last 30 days)
        gigs = supabase.table("gigs")\
            .select("category")\
            .gte("created_at", (datetime.utcnow() - timedelta(days=30)).isoformat())\
            .execute().data or []

        category_count = {}
        for gig in gigs:
            cat = gig.get("category")
            if cat:
                category_count[cat] = category_count.get(cat, 0) + 1

        trending_categories = sorted(
            [{"name": name, "count": count} for name, count in category_count.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:8]

        # Featured VAs (highest rated, verified)
        sellers_res = supabase.table("profiles")\
            .select("id, full_name, rating, avatar_url, is_verified")\
            .eq("role", "seller")\
            .eq("is_verified", True)\
            .order("rating", desc=True)\
            .limit(6).execute()

        featured_vas = []
        for seller in (sellers_res.data or []):
            min_price_res = supabase.table("gigs")\
                .select("price")\
                .eq("seller_id", seller["id"])\
                .order("price")\
                .limit(1).maybe_single().execute()

            min_price = min_price_res.data["price"] if min_price_res.data else 250

            featured_vas.append({
                "id": seller["id"],
                "full_name": seller["full_name"],
                "rating": seller["rating"] or 0,
                "avatar_url": seller["avatar_url"],
                "starting_price": min_price,
                "is_verified": seller["is_verified"]
            })

        return jsonify({
            "trendingCategories": trending_categories,
            "featuredVAs": featured_vas
        }), 200

    except Exception as e:
        current_app.logger.error(f"Dashboard error: {str(e)}")
        return jsonify({"error": "Failed to load dashboard"}), 500


# ────────────────────────────────────────────────
# GET /api/buyer/conversations
# List of active conversations/bookings
# ────────────────────────────────────────────────
@bp.route("/conversations", methods=["GET"])
@jwt_required()
def buyer_conversations():
    buyer_id = get_jwt_identity()

    try:
        bookings = supabase.table("bookings")\
            .select("""
                id, status, start_time,
                seller:seller_id (id, full_name, avatar_url)
            """)\
            .eq("buyer_id", buyer_id)\
            .in_("status", ["pending", "in_progress", "completed"])\
            .order("start_time", desc=True).execute().data or []

        conversations = []
        for b in bookings:
            conversations.append({
                "id": b["id"],
                "seller": {
                    "id": b["seller"]["id"],
                    "name": b["seller"]["full_name"] or "Seller",
                    "avatar": b["seller"]["avatar_url"]
                },
                "last_message": "Booking update or message",  # TODO: real last message
                "last_message_time": b["start_time"],
                "unread_count": 0,  # TODO: real unread
                "status": b["status"]
            })

        return jsonify(conversations), 200

    except Exception as e:
        current_app.logger.error(f"Conversations error: {str(e)}")
        return jsonify({"error": "Failed to load conversations"}), 500


# ────────────────────────────────────────────────
# GET /api/buyer/bookings
# All bookings for current buyer
# ────────────────────────────────────────────────
@bp.route("/bookings", methods=["GET"])
@jwt_required()
def buyer_bookings():
    buyer_id = get_jwt_identity()

    try:
        res = supabase.table("bookings")\
            .select("""
                id, status, price, requirements, created_at, updated_at,
                gig:gig_id (id, title, price),
                seller:seller_id (id, full_name, avatar_url),
                reviews!booking_id (id)
            """)\
            .eq("buyer_id", buyer_id)\
            .order("created_at", desc=True).execute()

        bookings = []
        for row in (res.data or []):
            bookings.append({
                "id": row["id"],
                "status": row["status"],
                "price": row["price"],
                "requirements": row["requirements"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "gig": row["gig"] or {"title": "Untitled Gig", "price": row["price"]},
                "seller": row["seller"] or {"full_name": "Unknown", "avatar_url": None},
                "reviewed": bool(row["reviews"])
            })

        return jsonify(bookings), 200

    except Exception as e:
        current_app.logger.error(f"Bookings error: {str(e)}")
        return jsonify({"error": "Failed to load bookings"}), 500


# ────────────────────────────────────────────────
# PATCH /api/bookings/:id/cancel
# Cancel pending booking (buyer only)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/cancel", methods=["PATCH"])
@jwt_required()
def cancel_booking(id):
    buyer_id = get_jwt_identity()
    data = request.get_json()
    reason = data.get("reason", "").strip()

    if not reason or len(reason) < 10:
        return jsonify({"error": "Cancellation reason must be at least 10 characters"}), 400

    try:
        booking = supabase.table("bookings")\
            .select("id, status, buyer_id")\
            .eq("id", id)\
            .maybe_single().execute()

        if not booking.data:
            return jsonify({"error": "Booking not found"}), 404

        if booking.data["buyer_id"] != buyer_id:
            return jsonify({"error": "Unauthorized"}), 403

        if booking.data["status"] != "pending":
            return jsonify({"error": "Only pending bookings can be cancelled"}), 400

        supabase.table("bookings")\
            .update({
                "status": "cancelled",
                "cancel_reason": reason,
                "updated_at": "now()"
            })\
            .eq("id", id)\
            .execute()

        return jsonify({"message": "Booking cancelled successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Cancel booking error: {str(e)}")
        return jsonify({"error": "Failed to cancel booking"}), 500


# ────────────────────────────────────────────────
# POST /api/reviews
# Submit review for completed booking (buyer only)
# ────────────────────────────────────────────────
@bp.route("/reviews", methods=["POST"])
@jwt_required()
def create_review():
    buyer_id = get_jwt_identity()
    data = request.get_json()

    booking_id = data.get("booking_id")
    rating = data.get("rating")
    comment = data.get("comment", "").strip()

    if not booking_id or not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({"error": "Invalid review data"}), 400

    try:
        booking = supabase.table("bookings")\
            .select("id, status, buyer_id, seller_id")\
            .eq("id", booking_id)\
            .maybe_single().execute()

        if not booking.data:
            return jsonify({"error": "Booking not found"}), 404

        if booking.data["buyer_id"] != buyer_id:
            return jsonify({"error": "Unauthorized"}), 403

        if booking.data["status"] != "completed":
            return jsonify({"error": "Can only review completed bookings"}), 400

        # Check if already reviewed
        existing = supabase.table("reviews")\
            .select("id")\
            .eq("booking_id", booking_id)\
            .maybe_single().execute()

        if existing.data:
            return jsonify({"error": "You have already reviewed this booking"}), 409

        review = {
            "booking_id": booking_id,
            "reviewer_id": buyer_id,
            "reviewed_id": booking.data["seller_id"],
            "rating": rating,
            "comment": comment or None,
            "created_at": "now()"
        }

        supabase.table("reviews").insert(review).execute()

        return jsonify({"message": "Review submitted successfully"}), 201

    except Exception as e:
        current_app.logger.error(f"Review creation error: {str(e)}")
        return jsonify({"error": "Failed to submit review"}), 500


# ────────────────────────────────────────────────
# GET /api/sellers/search?q=...
# Search sellers (public + authenticated)
# ────────────────────────────────────────────────
@bp.route("/sellers/search", methods=["GET"])
@jwt_required(optional=True)
def sellers_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])

    try:
        res = supabase.table("profiles")\
            .select("id, full_name, avatar_url, rating, is_verified")\
            .eq("role", "seller")\
            .ilike("full_name", f"%{q}%")\
            .limit(10).execute()

        return jsonify(res.data or []), 200

    except Exception as e:
        current_app.logger.error(f"Seller search error: {str(e)}")
        return jsonify({"error": "Failed to search sellers"}), 500


# ────────────────────────────────────────────────
# POST /api/messages/start
# Buyer starts new conversation (seller cannot initiate)
# ────────────────────────────────────────────────
@bp.route("/messages/start", methods=["POST"])
@jwt_required()
def start_message():
    buyer_id = get_jwt_identity()
    data = request.get_json()

    receiver_id = data.get("receiver_id")
    content = data.get("content", "").strip()

    if not receiver_id or not content:
        return jsonify({"error": "Missing receiver or content"}), 400

    # Optional: check if receiver is a seller
    receiver = supabase.table("profiles")\
        .select("role")\
        .eq("id", receiver_id)\
        .maybe_single().execute()

    if not receiver.data or receiver.data["role"] != "seller":
        return jsonify({"error": "Can only message sellers"}), 400

    try:
        message = {
            "sender_id": buyer_id,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": "now()"
        }

        supabase.table("messages").insert(message).execute()

        return jsonify({"message": "Conversation started"}), 201

    except Exception as e:
        current_app.logger.error(f"Start message error: {str(e)}")
        return jsonify({"error": "Failed to start conversation"}), 500


# ────────────────────────────────────────────────
# GET /api/messages/:conversation_id
# Get message history (authenticated + participant check)
# ────────────────────────────────────────────────
@bp.route("/messages/<string:conversation_id>", methods=["GET"])
@jwt_required()
def get_chat_history(conversation_id):
    user_id = get_jwt_identity()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    try:
        # Verify user is part of conversation
        participant = supabase.table("messages")\
            .select("id")\
            .or_(f"sender_id.eq.{user_id},receiver_id.eq.{user_id}")\
            .eq("booking_id", conversation_id)\
            .limit(1).execute()

        if not participant.data:
            return jsonify({"error": "Conversation not found or unauthorized"}), 403

        res = supabase.table("messages")\
            .select("""
                id, content, created_at, sender_id, receiver_id,
                sender:profiles!sender_id (full_name, avatar_url),
                receiver:profiles!receiver_id (full_name, avatar_url)
            """)\
            .eq("booking_id", conversation_id)\
            .order("created_at", desc=False)\
            .range(offset, offset + limit - 1)\
            .execute()

        formatted = []
        for msg in (res.data or []):
            formatted.append({
                "id": msg["id"],
                "content": msg["content"],
                "created_at": msg["created_at"],
                "sender": {
                    "id": msg["sender_id"],
                    "name": msg["sender"]["full_name"] if msg["sender"] else "Unknown",
                    "avatar": msg["sender"]["avatar_url"]
                },
                "receiver": {
                    "id": msg["receiver_id"],
                    "name": msg["receiver"]["full_name"] if msg["receiver"] else "Unknown",
                    "avatar": msg["receiver"]["avatar_url"]
                },
                "is_sent_by_me": msg["sender_id"] == user_id
            })

        return jsonify(formatted), 200

    except Exception as e:
        current_app.logger.error(f"Chat history error: {str(e)}")
        return jsonify({"error": "Failed to load messages"}), 500


# ────────────────────────────────────────────────
# GET /api/notifications
# Recent notifications for current user
# ────────────────────────────────────────────────
@bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    limit = request.args.get("limit", 20, type=int)

    try:
        res = supabase.table("notifications")\
            .select("""
                id, type, content, created_at, read_at,
                sender:profiles!sender_id (full_name, avatar_url),
                related_id
            """)\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(limit).execute()

        notifications = []
        for n in (res.data or []):
            notifications.append({
                "id": n["id"],
                "type": n["type"],
                "content": n["content"],
                "created_at": n["created_at"],
                "read": bool(n["read_at"]),
                "sender": n["sender"],
                "related_id": n["related_id"]
            })

        return jsonify(notifications), 200

    except Exception as e:
        current_app.logger.error(f"Notifications error: {str(e)}")
        return jsonify({"error": "Failed to load notifications"}), 500


# ────────────────────────────────────────────────
# GET /api/notifications/unread-count
# Unread notification count
# ────────────────────────────────────────────────
@bp.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    user_id = get_jwt_identity()

    try:
        count_res = supabase.table("notifications")\
            .select("count", count="exact")\
            .eq("user_id", user_id)\
            .is_("read_at", None)\
            .execute()

        return jsonify({"unread_count": count_res.count or 0}), 200

    except Exception as e:
        current_app.logger.error(f"Unread count error: {str(e)}")
        return jsonify({"error": "Failed to get unread count"}), 500


# ────────────────────────────────────────────────
# PATCH /api/notifications/mark-read
# Mark notifications as read (one or all)
# ────────────────────────────────────────────────
@bp.route("/notifications/mark-read", methods=["PATCH"])
@jwt_required()
def mark_notifications_read():
    user_id = get_jwt_identity()
    data = request.get_json()
    notification_id = data.get("id")  # optional

    try:
        query = supabase.table("notifications")\
            .update({"read_at": "now()"})\
            .eq("user_id", user_id)\
            .is_("read_at", None)

        if notification_id:
            query = query.eq("id", notification_id)

        res = query.execute()

        return jsonify({"message": f"{res.count or 0} notification(s) marked as read"}), 200

    except Exception as e:
        current_app.logger.error(f"Mark read error: {str(e)}")
        return jsonify({"error": "Failed to mark notifications as read"}), 500


# ────────────────────────────────────────────────
# POST /api/profile/avatar
# Upload avatar with rate limiting + validation
# ────────────────────────────────────────────────
@bp.route("/profile/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    user_id = get_jwt_identity()

    # Basic rate limit: 1 upload per 5 minutes
    last_upload = avatar_upload_attempts.get(user_id)
    if last_upload and (datetime.utcnow() - last_upload).total_seconds() < 300:
        return jsonify({"error": "Please wait 5 minutes before uploading again"}), 429

    if "avatar" not in request.files:
        return jsonify({"error": "No avatar file provided"}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    file_content = file.read()
    if len(file_content) > MAX_AVATAR_SIZE:
        return jsonify({"error": "File too large (max 5MB)"}), 400

    try:
        file.seek(0)
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = secure_filename(f"{user_id}_{uuid.uuid4().hex}.{ext}")
        path = f"avatars/{user_id}/{filename}"  # user-specific subfolder

        # Upload to Supabase Storage
        upload_res = supabase.storage.from_("avatars").upload(
            path=path,
            file=file_content,
            file_options={"cacheControl": "3600", "upsert": "true"}
        )

        if upload_res.status_code not in (200, 201):
            return jsonify({"error": "Failed to upload to storage"}), 500

        public_url = supabase.storage.from_("avatars").get_public_url(path)

        # Update profile
        supabase.table("profiles")\
            .update({"avatar_url": public_url})\
            .eq("id", user_id)\
            .execute()

        # Update rate limit
        avatar_upload_attempts[user_id] = datetime.utcnow()

        return jsonify({
            "message": "Avatar uploaded successfully",
            "publicUrl": public_url
        }), 200

    except Exception as e:
        current_app.logger.error(f"Avatar upload error: {str(e)}")
        return jsonify({"error": "Failed to upload avatar"}), 500