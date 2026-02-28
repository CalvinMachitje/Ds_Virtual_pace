# app/routes/buyer.py
from venv import logger
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
# Trending categories + featured sellers
# ────────────────────────────────────────────────
@bp.route("/dashboard", methods=["GET"])
@jwt_required(optional=True)  # optional = allow unauthenticated visitors too
def buyer_dashboard():
    try:
        # 1. Trending categories (last 30 days)
        gigs = supabase.table("gigs")\
            .select("category")\
            .gte("created_at", (datetime.utcnow() - timedelta(days=30)).isoformat())\
            .execute().data or []

        from collections import Counter
        category_count = Counter(gig.get("category") for gig in gigs if gig.get("category"))
        
        trending_categories = [
            {"name": name, "count": count}
            for name, count in category_count.most_common(8)
        ]

        # 2. Featured sellers (verified + highest rated, limit 6)
        sellers_res = supabase.table("profiles")\
            .select("id, full_name, rating, avatar_url, is_verified")\
            .eq("role", "seller")\
            .eq("is_verified", True)\
            .order("rating", desc=True)\
            .limit(6)\
            .execute()

        featured_sellers = []
        for seller in (sellers_res.data or []):
            # Safely get minimum price (or fallback)
            min_price_res = supabase.table("gigs")\
                .select("price")\
                .eq("seller_id", seller["id"])\
                .order("price")\
                .limit(1)\
                .maybe_single()\
                .execute()

            min_price = (
                min_price_res.data["price"]
                if min_price_res.data and "price" in min_price_res.data
                else 250
            )

            featured_sellers.append({
                "id": seller["id"],
                "full_name": seller["full_name"] or "Unnamed Seller",
                "rating": seller["rating"] or 0.0,
                "avatar_url": seller["avatar_url"],
                "starting_price": min_price,
                "is_verified": seller["is_verified"]
            })

        return jsonify({
            "trendingCategories": trending_categories,
            "featuredVAs": featured_sellers   # note: renamed to match frontend expectation
        }), 200

    except Exception as e:
        current_app.logger.exception("Buyer dashboard failed")  # full traceback
        return jsonify({
            "error": "Failed to load dashboard data",
            "details": str(e) if current_app.debug else None
        }), 500

# ────────────────────────────────────────────────
# GET /api/buyer/conversations
# List buyer conversations
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
                "last_message": "Booking update or message",
                "last_message_time": b["start_time"],
                "unread_count": 0,
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
# PATCH /api/buyer/bookings/:id/cancel
# Cancel pending booking
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
            .eq("id", id).execute()

        return jsonify({"message": "Booking cancelled successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Cancel booking error: {str(e)}")
        return jsonify({"error": "Failed to cancel booking"}), 500

# ────────────────────────────────────────────────
# GET /api/buyer/profile/:id/bookings
# Get recent bookings for a buyer (limited fields, paginated)
# ────────────────────────────────────────────────
@bp.route("/profile/<string:user_id>/bookings", methods=["GET"])
@jwt_required()
def get_buyer_bookings(user_id: str):
    current_user = get_jwt_identity()
    limit = request.args.get("limit", 5, type=int)

    # Only allow fetching own bookings (or admin later)
    if current_user != user_id:
        return jsonify({"error": "You can only view your own bookings"}), 403

    try:
        bookings = supabase.table("bookings")\
            .select("""
                id,
                gig_id,
                seller_id,
                status,
                price,
                created_at,
                gig:gig_id (title),
                seller:seller_id (full_name)
            """)\
            .eq("buyer_id", user_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()

        formatted = []
        for b in (bookings.data or []):
            formatted.append({
                "id": b["id"],
                "gig_title": b["gig"]["title"] if b["gig"] else "Untitled Gig",
                "seller_name": b["seller"]["full_name"] if b["seller"] else "Unknown Seller",
                "status": b["status"],
                "price": b["price"] or 0,
                "created_at": b["created_at"]
            })

        return jsonify(formatted), 200

    except Exception as e:
        current_app.logger.exception(f"Bookings fetch failed for buyer {user_id}")
        return jsonify({"error": "Failed to load bookings"}), 500

# ────────────────────────────────────────────────
# POST /api/buyer/reviews
# Submit a review for a completed booking (buyer only)
# ────────────────────────────────────────────────
@bp.route("/reviews", methods=["POST"])
@jwt_required()
def create_review():
    buyer_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    booking_id = data.get("booking_id")
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    # Validation
    if not booking_id:
        return jsonify({"error": "booking_id is required"}), 400

    if not isinstance(rating, (int, float)) or not (1 <= rating <= 5):
        return jsonify({"error": "Rating must be a number between 1 and 5"}), 400

    try:
        # 1. Fetch booking + validate
        booking_res = supabase.table("bookings")\
            .select("id, status, buyer_id, seller_id")\
            .eq("id", booking_id)\
            .maybe_single().execute()

        if booking_res is None or not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        booking = booking_res.data

        if booking["buyer_id"] != buyer_id:
            return jsonify({"error": "Unauthorized - not your booking"}), 403

        if booking["status"] != "completed":
            return jsonify({"error": "Can only review completed bookings"}), 400

        # 2. Check for existing review (prevent duplicates)
        existing_res = supabase.table("reviews")\
            .select("id")\
            .eq("booking_id", booking_id)\
            .maybe_single().execute()

        if existing_res is not None and existing_res.data:
            return jsonify({"error": "You have already reviewed this booking"}), 409

        # 3. Prepare review data (matches your schema: no updated_at)
        review_data = {
            "booking_id": booking_id,
            "reviewer_id": buyer_id,
            "reviewed_id": booking["seller_id"],   # correct FK column
            "rating": float(rating),
            "comment": comment if comment else None,
            "created_at": "now()"
        }

        # Debug: show what is being inserted
        print("DEBUG: Inserting review →", review_data)

        # 4. Insert review
        insert_res = supabase.table("reviews").insert(review_data).execute()

        if insert_res is None or not insert_res.data:
            return jsonify({"error": "Failed to create review"}), 500

        return jsonify({
            "message": "Review submitted successfully",
            "review_id": insert_res.data[0]["id"]
        }), 201

    except Exception as e:
        current_app.logger.exception("Review creation failed")
        return jsonify({
            "error": "Failed to submit review",
            "details": str(e) if current_app.debug else None
        }), 500


# ────────────────────────────────────────────────
# Helper: recalculates seller rating & count
# ────────────────────────────────────────────────
def recalculate_seller_rating(seller_id: str):
    try:
        ratings_res = supabase.table("reviews")\
            .select("rating")\
            .eq("reviewed_id", seller_id)\
            .execute()

        ratings = [r["rating"] for r in (ratings_res.data or [])]
        count = len(ratings)

        avg = round(sum(ratings) / count, 1) if count > 0 else 0.0

        supabase.table("profiles")\
            .update({
                "average_rating": avg,
                "review_count": count,
                "updated_at": "now()"
            })\
            .eq("id", seller_id)\
            .execute()

        current_app.logger.info(f"Recalculated rating for seller {seller_id}: {avg} ({count} reviews)")

    except Exception as e:
        current_app.logger.error(f"Rating recalculation failed for {seller_id}: {str(e)}")


# ────────────────────────────────────────────────
# GET /api/sellers/search?q=...
# Search sellers
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
# POST /api/buyer/messages/start
# Buyer starts a conversation with a seller
# ────────────────────────────────────────────────
@bp.route("/messages/start", methods=["POST"])
@jwt_required()
def start_message():
    buyer_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    receiver_id = data.get("receiver_id")
    content = (data.get("content") or "").strip()

    if not receiver_id or not content:
        return jsonify({"error": "receiver_id and content are required"}), 400

    try:
        # Verify receiver is a seller
        receiver = supabase.table("profiles")\
            .select("role")\
            .eq("id", receiver_id)\
            .maybe_single().execute()

        if receiver is None or not receiver.data:
            return jsonify({"error": "Seller not found"}), 404

        if receiver.data["role"] != "seller":
            return jsonify({"error": "Can only message sellers"}), 400

        # Create the first message
        message = {
            "sender_id": buyer_id,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": "now()"
        }

        insert_res = supabase.table("messages").insert(message).execute()

        if insert_res is None or not insert_res.data:
            return jsonify({"error": "Failed to send initial message"}), 500

        return jsonify({
            "message": "Conversation started",
            "conversation_id": receiver_id,
            "first_message_id": insert_res.data[0]["id"]
        }), 201

    except Exception as e:
        logger.exception("Start message failed")
        return jsonify({"error": "Failed to start conversation"}), 500


# ────────────────────────────────────────────────
# GET /api/buyer/messages/conversation/<conversation_id>
# Get message history (conversation_id = other user's ID)
# ────────────────────────────────────────────────
@bp.route("/messages/conversation/<string:conversation_id>", methods=["GET"])
@jwt_required()
def get_buyer_chat_history(conversation_id):
    user_id = get_jwt_identity()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    try:
        # Verify user is part of this conversation
        participant = supabase.table("messages")\
            .select("id")\
            .or_(f"sender_id.eq.{user_id},receiver_id.eq.{user_id}")\
            .eq("receiver_id", conversation_id)\
            .limit(1).execute()

        if participant is None or not participant.data:
            return jsonify({"error": "Conversation not found or unauthorized"}), 403

        # Fetch messages
        res = supabase.table("messages")\
            .select("""
                id, content, created_at, sender_id, receiver_id, is_file, file_url, mime_type, file_name, read_at,
                sender:profiles!sender_id (full_name, avatar_url),
                receiver:profiles!receiver_id (full_name, avatar_url)
            """)\
            .or_(f"sender_id.eq.{user_id},receiver_id.eq.{user_id}")\
            .eq("receiver_id", conversation_id)\
            .order("created_at", desc=False)\
            .range(offset, offset + limit - 1).execute()

        formatted = []
        for msg in (res.data or []):
            formatted.append({
                "id": msg["id"],
                "content": msg["content"],
                "created_at": msg["created_at"],
                "sender_id": msg["sender_id"],
                "receiver_id": msg["receiver_id"],
                "is_file": msg["is_file"],
                "file_url": msg["file_url"],
                "mime_type": msg["mime_type"],
                "file_name": msg["file_name"],
                "read_at": msg["read_at"],
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
        logger.exception(f"Buyer chat history error for {conversation_id}")
        return jsonify({"error": "Failed to load messages"}), 500


# ────────────────────────────────────────────────
# POST /api/messages/upload
# Upload file for chat message
# ────────────────────────────────────────────────
@bp.route("/messages/upload", methods=["POST"])
@jwt_required()
def upload_message_file():
    user_id = get_jwt_identity()

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join("uploads/messages", unique_filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        file.save(file_path)

        # Assuming you have a public URL or Supabase storage URL
        file_url = f"/uploads/messages/{unique_filename}"  # adjust to your static file serving

        mime_type = file.mimetype
        return jsonify({
            "url": file_url,
            "mime_type": mime_type,
            "file_name": filename
        }), 200

    return jsonify({"error": "File type not allowed"}), 400

# ────────────────────────────────────────────────
# Notifications endpoints
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


@bp.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    user_id = get_jwt_identity()
    try:
        count_res = supabase.table("notifications")\
            .select("count", count="exact")\
            .eq("user_id", user_id)\
            .is_("read_at", None).execute()

        return jsonify({"unread_count": count_res.count or 0}), 200

    except Exception as e:
        current_app.logger.error(f"Unread count error: {str(e)}")
        return jsonify({"error": "Failed to get unread count"}), 500


@bp.route("/notifications/mark-read", methods=["PATCH"])
@jwt_required()
def mark_notifications_read():
    user_id = get_jwt_identity()
    data = request.get_json()
    notification_id = data.get("id")
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
# GET /api/profile/:id
# Public: Get basic profile info for any user (buyer or seller)
# ────────────────────────────────────────────────
@bp.route("/profile/<string:user_id>", methods=["GET"])
def get_profile(user_id: str):
    """
    Public endpoint: Fetch basic profile details by user ID
    Returns minimal info suitable for public viewing
    """
    try:
        profile = supabase.table("profiles")\
            .select("""
                id,
                full_name,
                role,
                bio,
                avatar_url,
                phone,
                created_at,
                updated_at,
                is_verified
            """)\
            .eq("id", user_id)\
            .maybe_single()\
            .execute()

        if not profile.data:
            return jsonify({"error": "Profile not found"}), 404

        # Optional: add review count & average rating
        reviews = supabase.table("reviews")\
            .select("rating")\
            .eq("reviewed_id", user_id)\
            .execute().data or []

        review_count = len(reviews)
        avg_rating = round(sum(r["rating"] for r in reviews) / review_count, 1) if review_count > 0 else 0.0

        return jsonify({
            **profile.data,
            "average_rating": avg_rating,
            "review_count": review_count,
            "interests": []  # Placeholder – add column if needed
        }), 200

    except Exception as e:
        current_app.logger.exception(f"Profile fetch failed for user {user_id}")
        return jsonify({"error": "Failed to load profile"}), 500


# ────────────────────────────────────────────────
# PATCH /api/profile/:id
# Update own profile (authenticated user only)
# Allowed fields: full_name, bio, phone, interests
# ────────────────────────────────────────────────
@bp.route("/profile/<string:user_id>", methods=["PATCH"])
@jwt_required()
def update_profile(user_id: str):
    current_user = get_jwt_identity()

    if current_user != user_id:
        return jsonify({"error": "You can only update your own profile"}), 403

    data = request.get_json(silent=True) or {}

    # Only allow safe fields
    allowed = ["full_name", "bio", "phone", "interests"]
    update_data = {k: v for k, v in data.items() if k in allowed and v is not None}

    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400

    # Basic validation
    if "full_name" in update_data:
        name = (update_data["full_name"] or "").strip()
        if len(name) < 2 or len(name) > 100:
            return jsonify({"error": "Full name must be 2–100 characters"}), 400
        update_data["full_name"] = name

    if "phone" in update_data:
        phone = (update_data["phone"] or "").strip()
        update_data["phone"] = phone if phone else None

    if "bio" in update_data:
        bio = (update_data["bio"] or "").strip()
        if len(bio) > 1000:
            return jsonify({"error": "Bio cannot exceed 1000 characters"}), 400
        update_data["bio"] = bio

    if "interests" in update_data:
        if not isinstance(update_data["interests"], list):
            return jsonify({"error": "Interests must be a list"}), 400
        update_data["interests"] = [i.strip() for i in update_data["interests"] if i.strip()]

    try:
        res = supabase.table("profiles")\
            .update({**update_data, "updated_at": "now()"})\
            .eq("id", user_id)\
            .execute()

        if not res.data:
            return jsonify({"error": "Profile not found"}), 404

        return jsonify({
            "message": "Profile updated successfully",
            "updated_fields": list(update_data.keys())
        }), 200

    except Exception as e:
        current_app.logger.exception(f"Profile update failed for user {user_id}")
        return jsonify({"error": "Failed to update profile"}), 500


# ────────────────────────────────────────────────
# POST /api/profile/avatar
# Upload avatar (rate-limited)
# ────────────────────────────────────────────────
@bp.route("/profile/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    user_id = get_jwt_identity()

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
        path = f"avatars/{user_id}/{filename}"

        upload_res = supabase.storage.from_("avatars").upload(
            path=path,
            file=file_content,
            file_options={"cacheControl": "3600", "upsert": "true"}
        )

        if upload_res.status_code not in (200, 201):
            return jsonify({"error": "Failed to upload to storage"}), 500

        public_url = supabase.storage.from_("avatars").get_public_url(path)

        supabase.table("profiles").update({"avatar_url": public_url}).eq("id", user_id).execute()
        avatar_upload_attempts[user_id] = datetime.utcnow()

        return jsonify({"message": "Avatar uploaded successfully", "publicUrl": public_url}), 200

    except Exception as e:
        current_app.logger.error(f"Avatar upload error: {str(e)}")
        return jsonify({"error": "Failed to upload avatar"}), 500


@bp.route("/debug/supabase", methods=["GET"])
def debug_supabase():
    status = supabase.check_connection()
    return jsonify(status), 200

# ────────────────────────────────────────────────
# GET /api/buyer/categories/<slug>
# Get sellers who have at least one gig in the given category
# ────────────────────────────────────────────────
@bp.route("/categories/<slug>", methods=["GET"])
@jwt_required()
def get_category_sellers(slug):
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 9, type=int)
    min_rating = request.args.get("min_rating", 0, type=float)
    max_price = request.args.get("max_price", None, type=float)
    search = request.args.get("search", "")
    sort = request.args.get("sort", "ai")

    offset = (page - 1) * limit

    try:
        # Select profiles + their gigs
        query = supabase.table("profiles")\
            .select("""
                id,
                full_name,
                avatar_url,
                rating,
                is_verified,
                is_online,
                gigs!seller_id (id, title, description, price, category)
            """)\
            .eq("role", "seller")

        # Filter sellers that have at least one gig where category = slug
        # Use .filter() on the joined gigs
        query = query.filter("gigs.category", "eq", slug)

        # Other filters
        if min_rating > 0:
            query = query.gte("rating", min_rating)

        if search:
            query = query.or_(
                f"full_name.ilike.%{search}%,"
                f"gigs.title.ilike.%{search}%"
            )

        # Sorting (example - can be improved)
        if sort == "rating-high":
            query = query.order("rating", desc=True)
        elif sort == "newest":
            query = query.order("created_at", desc=True)
        else:
            query = query.order("rating", desc=True)  # default

        # Pagination
        res = query.range(offset, offset + limit - 1).execute()

        sellers_raw = res.data or []
        total = res.count or 0

        # Format to match frontend SellerGroup type
        formatted_sellers = []
        for profile in sellers_raw:
            gigs = profile.pop("gigs", [])
            formatted_sellers.append({
                "seller": profile,
                "gigs": gigs,
                "reviewCount": profile.get("review_count", 0)
            })

        return jsonify({
            "sellers": formatted_sellers,
            "total": total,
            "page": page,
            "has_more": len(sellers_raw) == limit,
            "message": "No sellers found for this category" if not sellers_raw else None
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Saved Sellers Endpoints (unchanged from previous)
# ────────────────────────────────────────────────

@bp.route("/saved/<seller_id>", methods=["GET"])
@jwt_required()
def check_saved_seller(seller_id):
    user_id = get_jwt_identity()
    try:
        res = supabase.table("saved_sellers")\
            .select("id")\
            .eq("buyer_id", user_id)\
            .eq("seller_id", seller_id)\
            .execute()
        return jsonify({"saved": bool(res.data)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/saved", methods=["POST"])
@jwt_required()
def save_seller():
    user_id = get_jwt_identity()
    data = request.get_json()
    if not data or "seller_id" not in data:
        return jsonify({"error": "seller_id is required"}), 400

    seller_id = data["seller_id"]
    try:
        check = supabase.table("saved_sellers")\
            .select("id")\
            .eq("buyer_id", user_id)\
            .eq("seller_id", seller_id)\
            .execute()
        if check.data:
            return jsonify({"message": "Already saved"}), 200

        entry = {
            "id": str(uuid.uuid4()),
            "buyer_id": user_id,
            "seller_id": seller_id,
            "created_at": "now()"
        }
        res = supabase.table("saved_sellers").insert(entry).execute()
        return jsonify({"message": "Seller saved"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/saved/<seller_id>", methods=["DELETE"])
@jwt_required()
def unsave_seller(seller_id):
    user_id = get_jwt_identity()
    try:
        res = supabase.table("saved_sellers")\
            .delete()\
            .eq("buyer_id", user_id)\
            .eq("seller_id", seller_id)\
            .execute()
        return jsonify({"message": "Seller unsaved"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# Buyer Requests (unchanged)
# ────────────────────────────────────────────────
@bp.route("/requests", methods=["POST"])
@jwt_required()
def create_buyer_request():
    user_id = get_jwt_identity()
    data = request.get_json()

    required = ["category", "title", "description"]
    if not data or not all(f in data for f in required):
        return jsonify({"error": "category, title, and description required"}), 400

    try:
        req = {
            "id": str(uuid.uuid4()),
            "buyer_id": user_id,
            "category": data["category"],
            "title": data["title"].strip(),
            "description": data["description"].strip(),
            "budget": data.get("budget"),
            "preferred_start_time": data.get("preferred_start_time"),
            "estimated_due_time": data.get("estimated_due_time"),
            "seller_id": data.get("seller_id"),
            "status": "pending_admin",
            "created_at": "now()"
        }

        res = supabase.table("job_requests").insert(req).execute()
        return jsonify({
            "message": "Request submitted",
            "request": res.data[0]
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500