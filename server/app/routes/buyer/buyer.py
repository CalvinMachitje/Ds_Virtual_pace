# app/routes/buyer.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime
from werkzeug.utils import secure_filename

bp = Blueprint("buyer", __name__, url_prefix="/api/buyer")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ────────────────────────────────────────────────
# GET /api/buyer/dashboard
# Trending categories + featured VAs
# ────────────────────────────────────────────────
@bp.route("/dashboard", methods=["GET"])
@jwt_required(optional=True)
def buyer_dashboard():
    try:
        # Trending categories
        gigs = supabase.table("gigs").select("category").execute().data or []
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

        # Featured VAs
        sellers_res = supabase.table("profiles")\
            .select("id, full_name, rating, avatar_url")\
            .eq("role", "seller")\
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
                "starting_price": min_price
            })

        return jsonify({
            "trendingCategories": trending_categories,
            "featuredVAs": featured_vas
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/buyer/conversations
# List of conversations/bookings
# ────────────────────────────────────────────────
@bp.route("/conversations", methods=["GET"])
@jwt_required()
def buyer_conversations():
    buyer_id = get_jwt_identity()

    try:
        bookings = supabase.table("bookings")\
            .select("""
                id, status, start_time,
                seller:seller_id (full_name, avatar_url)
            """)\
            .eq("buyer_id", buyer_id)\
            .order("start_time", desc=True).execute().data or []

        conversations = []
        for b in bookings:
            conversations.append({
                "id": b["id"],
                "seller_name": b["seller"]["full_name"] if b["seller"] else "Seller",
                "seller_avatar": b["seller"]["avatar_url"],
                "last_message": "New booking or message",  # Replace with real last message query later
                "last_message_time": datetime.fromisoformat(b["start_time"]).strftime("%Y-%m-%d"),
                "unread_count": 0,  # TODO: real unread count
                "status": b["status"]
            })

        return jsonify(conversations), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
                seller:seller_id (id, full_name),
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
                "seller": row["seller"] or {"full_name": "Unknown"},
                "reviewed": bool(row["reviews"])
            })

        return jsonify(bookings), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# PATCH /api/bookings/:id/cancel
# Cancel pending booking
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/cancel", methods=["PATCH"])
@jwt_required()
def cancel_booking(id):
    buyer_id = get_jwt_identity()
    data = request.get_json()
    reason = data.get("reason")

    if not reason or len(reason.strip()) < 10:
        return jsonify({"error": "Reason must be at least 10 characters"}), 400

    try:
        res = supabase.table("bookings")\
            .update({
                "status": "cancelled",
                "cancel_reason": reason.strip(),
                "updated_at": "now()"
            })\
            .eq("id", id)\
            .eq("buyer_id", buyer_id)\
            .eq("status", "pending")\
            .execute()

        if not res.data:
            return jsonify({"error": "Booking not found or cannot be cancelled"}), 400

        return jsonify({"message": "Booking cancelled"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# POST /api/reviews
# Submit review for completed booking
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
            .select("id, status, seller_id")\
            .eq("id", booking_id)\
            .eq("buyer_id", buyer_id)\
            .maybe_single().execute()

        if not booking.data or booking.data["status"] != "completed":
            return jsonify({"error": "Booking not found or not completed"}), 403

        existing = supabase.table("reviews")\
            .select("id")\
            .eq("booking_id", booking_id)\
            .maybe_single().execute()

        if existing.data:
            return jsonify({"error": "Already reviewed"}), 409

        review = {
            "booking_id": booking_id,
            "reviewer_id": buyer_id,
            "reviewed_id": booking.data["seller_id"],
            "rating": rating,
            "comment": comment or None
        }

        res = supabase.table("reviews").insert(review).execute()

        if not res.data:
            return jsonify({"error": "Failed to submit review"}), 500

        return jsonify({"message": "Review submitted"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/sellers/search?q=...
# Search sellers for new chat
# ────────────────────────────────────────────────
@bp.route("/sellers/search", methods=["GET"])
@jwt_required(optional=True)
def sellers_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])

    try:
        res = supabase.table("profiles")\
            .select("id, full_name, avatar_url")\
            .eq("role", "seller")\
            .ilike("full_name", f"%{q}%")\
            .limit(10).execute()

        return jsonify(res.data or []), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# POST /api/messages/start
# Start new conversation
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

    try:
        message = {
            "sender_id": buyer_id,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": "now()"
        }

        res = supabase.table("messages").insert(message).execute()

        if not res.data:
            return jsonify({"error": "Failed to send message"}), 500

        return jsonify({"message": "Conversation started"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/messages/:conversation_id
# Message history for a conversation
# ────────────────────────────────────────────────
@bp.route("/messages/<string:conversation_id>", methods=["GET"])
@jwt_required()
def get_chat_history(conversation_id):
    user_id = get_jwt_identity()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    try:
        res = supabase.table("messages")\
            .select("""
                id, content, created_at, sender_id, receiver_id,
                sender:profiles!sender_id (full_name, avatar_url),
                receiver:profiles!receiver_id (full_name, avatar_url)
            """)\
            .or_(f"sender_id.eq.{user_id},receiver_id.eq.{user_id}")\
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
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/notifications
# List recent notifications
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
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/notifications/unread-count
# Unread count for badge
# ────────────────────────────────────────────────
@bp.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    user_id = get_jwt_identity()

    try:
        count_res = supabase.table("notifications")\
            .select("count", count="exact")\
            .eq("user_id", user_id)\
            .is_("read_at", "null")\
            .execute()

        return jsonify({"unread_count": count_res.count or 0}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# PATCH /api/notifications/mark-read
# Mark one or all as read
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
            .is_("read_at", "null")

        if notification_id:
            query = query.eq("id", notification_id)

        res = query.execute()

        return jsonify({"message": f"{res.count or 0} marked as read"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# POST /api/profile/avatar
# Upload avatar with validation
# ────────────────────────────────────────────────
@bp.route("/profile/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    user_id = get_jwt_identity()

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
        file.seek(0)  # reset pointer
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = secure_filename(f"{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{ext}")
        path = f"avatars/{filename}"

        upload_res = supabase.storage.from_("avatars").upload(
            path=path,
            file=file_content,
            file_options={"cacheControl": "3600", "upsert": "true"}
        )

        if upload_res.status_code not in (200, 201):
            return jsonify({"error": "Storage upload failed"}), 500

        public_url = supabase.storage.from_("avatars").get_public_url(path)

        supabase.table("profiles")\
            .update({"avatar_url": public_url})\
            .eq("id", user_id)\
            .execute()

        return jsonify({
            "message": "Avatar uploaded",
            "publicUrl": public_url
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500