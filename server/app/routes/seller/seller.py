# app/routes/seller.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime
from werkzeug.utils import secure_filename
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta

bp = Blueprint("seller", __name__, url_prefix="/api/seller")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ────────────────────────────────────────────────
# POST /api/seller/gigs
# Create new gig
# ────────────────────────────────────────────────
@bp.route("/gigs", methods=["POST"])
@jwt_required()
def create_gig():
    seller_id = get_jwt_identity()
    data = request.get_json()

    required = ["title", "category", "description", "price"]
    for field in required:
        if field not in data or not data[field]:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    title = data["title"].strip()
    description = data["description"].strip()
    price = data["price"]
    category = data["category"]
    gallery_urls = data.get("gallery_urls", []) or []

    if len(title) < 8 or len(title) > 80:
        return jsonify({"error": "Title must be 8–80 characters"}), 400

    if len(description) < 120 or len(description) > 5000:
        return jsonify({"error": "Description must be 120–5000 characters"}), 400

    if not isinstance(price, (int, float)) or price < 50 or price > 2000:
        return jsonify({"error": "Price must be between R50 and R2000"}), 400

    if len(gallery_urls) > 5:
        return jsonify({"error": "Maximum 5 images allowed"}), 400

    try:
        gig = {
            "seller_id": seller_id,
            "title": title,
            "description": description,
            "price": float(price),
            "category": category,
            "gallery_urls": gallery_urls,
            "status": "published",
            "created_at": "now()",
            "updated_at": "now()"
        }

        res = supabase.table("gigs").insert(gig).execute()

        if not res.data:
            return jsonify({"error": "Failed to create gig"}), 500

        return jsonify({
            "message": "Gig created and published",
            "gig_id": res.data[0]["id"]
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/seller/gigs
# List seller's gigs (paginated)
# ────────────────────────────────────────────────
@bp.route("/gigs", methods=["GET"])
@jwt_required()
def list_seller_gigs():
    seller_id = get_jwt_identity()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 12, type=int)

    from_idx = (page - 1) * per_page
    to_idx = from_idx + per_page - 1

    try:
        res = supabase.table("gigs")\
            .select("id, title, description, price, category, status, gallery_urls, created_at", count="exact")\
            .eq("seller_id", seller_id)\
            .range(from_idx, to_idx)\
            .order("created_at", desc=True)\
            .execute()

        gigs = res.data or []

        return jsonify({
            "gigs": gigs,
            "total": res.count or 0,
            "page": page,
            "per_page": per_page,
            "has_more": len(gigs) == per_page
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/seller/gigs/:id
# Get single gig
# ────────────────────────────────────────────────
@bp.route("/gigs/<string:id>", methods=["GET"])
@jwt_required()
def get_seller_gig(id):
    seller_id = get_jwt_identity()

    try:
        res = supabase.table("gigs")\
            .select("*")\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .maybe_single().execute()

        if not res.data:
            return jsonify({"error": "Gig not found or not owned by you"}), 404

        return jsonify(res.data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/gigs/:id
# Update gig
# ────────────────────────────────────────────────
@bp.route("/gigs/<string:id>", methods=["PATCH"])
@jwt_required()
def update_seller_gig(id):
    seller_id = get_jwt_identity()
    data = request.get_json()

    allowed_fields = ["title", "category", "description", "price", "gallery_urls", "status"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        res = supabase.table("gigs")\
            .update(update_data)\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .execute()

        if not res.data:
            return jsonify({"error": "Gig not found or not yours"}), 404

        return jsonify({"message": "Gig updated"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# DELETE /api/seller/gigs/:id
# Delete single gig
# ────────────────────────────────────────────────
@bp.route("/gigs/<string:id>", methods=["DELETE"])
@jwt_required()
def delete_seller_gig(id):
    seller_id = get_jwt_identity()

    try:
        res = supabase.table("gigs")\
            .delete()\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .execute()

        if res.data is None:
            return jsonify({"error": "Gig not found or not yours"}), 404

        return jsonify({"message": "Gig deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# POST /api/seller/gig-images
# Upload gig gallery images
# ────────────────────────────────────────────────
@bp.route("/gig-images", methods=["POST"])
@jwt_required()
def upload_gig_images():
    seller_id = get_jwt_identity()

    if "images" not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist("images")
    if not files or len(files) == 0:
        return jsonify({"error": "No images selected"}), 400

    uploaded_urls = []

    for file in files:
        if file.filename == "" or not allowed_file(file.filename):
            continue

        if len(file.read()) > MAX_IMAGE_SIZE:
            return jsonify({"error": f"Image {file.filename} too large (max 5MB)"}), 400

        file.seek(0)  # reset pointer after size check

        try:
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = secure_filename(f"{seller_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{ext}")
            path = f"gig-gallery/{filename}"

            upload_res = supabase.storage.from_("gig-gallery").upload(
                path=path,
                file=file.read(),
                file_options={"cacheControl": "3600", "upsert": "true"}
            )

            if upload_res.status_code not in (200, 201):
                continue

            public_url = supabase.storage.from_("gig-gallery").get_public_url(path)
            uploaded_urls.append(public_url)

        except Exception:
            continue

    return jsonify({
        "message": f"{len(uploaded_urls)} image(s) uploaded",
        "urls": uploaded_urls
    }), 200


# ────────────────────────────────────────────────
# POST /api/seller/portfolio-images
# Upload portfolio images
# ────────────────────────────────────────────────
@bp.route("/portfolio-images", methods=["POST"])
@jwt_required()
def upload_portfolio_images():
    seller_id = get_jwt_identity()

    if "images" not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images selected"}), 400

    uploaded_urls = []

    for file in files:
        if file.filename == "" or not allowed_file(file.filename):
            continue

        if len(file.read()) > MAX_IMAGE_SIZE:
            return jsonify({"error": f"Image {file.filename} too large (max 5MB)"}), 400

        file.seek(0)

        try:
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = secure_filename(f"portfolio_{seller_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{ext}")
            path = f"portfolio-images/{filename}"

            upload_res = supabase.storage.from_("portfolio-images").upload(
                path=path,
                file=file.read(),
                file_options={"cacheControl": "3600", "upsert": "true"}
            )

            if upload_res.status_code not in (200, 201):
                continue

            public_url = supabase.storage.from_("portfolio-images").get_public_url(path)
            uploaded_urls.append(public_url)

        except Exception:
            continue

    if uploaded_urls:
        # Append to existing portfolio_images array
        current = supabase.table("profiles")\
            .select("portfolio_images")\
            .eq("id", seller_id)\
            .single().execute().data

        existing = current.get("portfolio_images", []) if current else []
        updated = existing + uploaded_urls

        supabase.table("profiles")\
            .update({"portfolio_images": updated})\
            .eq("id", seller_id)\
            .execute()

    return jsonify({
        "message": f"{len(uploaded_urls)} portfolio image(s) uploaded",
        "urls": uploaded_urls
    }), 200


# ────────────────────────────────────────────────
# GET /api/seller/dashboard
# Seller stats for dashboard
# ────────────────────────────────────────────────
@bp.route("/dashboard", methods=["GET"])
@jwt_required()
def seller_dashboard():
    seller_id = get_jwt_identity()

    try:
        # Active gigs
        gigs_count = supabase.table("gigs")\
            .select("id", count="exact")\
            .eq("seller_id", seller_id)\
            .eq("status", "published")\
            .execute().count or 0

        # Active bookings
        active_bookings = supabase.table("bookings")\
            .select("id", count="exact")\
            .eq("seller_id", seller_id)\
            .in_("status", ["pending", "accepted"])\
            .execute().count or 0

        # Completed bookings
        completed_bookings = supabase.table("bookings")\
            .select("id", count="exact")\
            .eq("seller_id", seller_id)\
            .eq("status", "completed")\
            .execute().count or 0

        # Rating & reviews
        reviews_res = supabase.table("reviews")\
            .select("rating")\
            .eq("reviewed_id", seller_id)\
            .execute()

        review_count = len(reviews_res.data or [])
        avg_rating = sum(r["rating"] for r in (reviews_res.data or [])) / review_count if review_count else 0

        # Monthly earnings
        start_of_month = (datetime.utcnow() - relativedelta(months=0)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        earnings_res = supabase.table("bookings")\
            .select("price")\
            .eq("seller_id", seller_id)\
            .eq("status", "completed")\
            .gte("created_at", start_of_month.isoformat())\
            .execute()

        monthly_earnings = sum(b["price"] or 0 for b in (earnings_res.data or []))

        return jsonify({
            "activeGigs": gigs_count,
            "activeBookings": active_bookings,
            "completedBookings": completed_bookings,
            "rating": round(avg_rating, 1),
            "reviewCount": review_count,
            "monthlyEarnings": monthly_earnings
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/seller/bookings
# List seller's bookings
# ────────────────────────────────────────────────
@bp.route("/bookings", methods=["GET"])
@jwt_required()
def seller_bookings():
    seller_id = get_jwt_identity()

    try:
        res = supabase.table("bookings")\
            .select("""
                id, status, price, requirements, created_at, updated_at,
                gig:gig_id (id, title, price),
                buyer:buyer_id (id, full_name)
            """)\
            .eq("seller_id", seller_id)\
            .order("created_at", desc=True)\
            .execute()

        bookings = []
        for row in (res.data or []):
            bookings.append({
                "id": row["id"],
                "status": row["status"],
                "price": row["price"],
                "requirements": row["requirements"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "gig": row["gig"] or {"title": "Untitled", "price": row["price"]},
                "buyer": row["buyer"] or {"full_name": "Unknown"}
            })

        return jsonify(bookings), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/bookings/:id/status
# Update booking status (accept/reject)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/status", methods=["PATCH"])
@jwt_required()
def update_booking_status(id):
    seller_id = get_jwt_identity()
    data = request.get_json()
    new_status = data.get("status")

    if new_status not in ["accepted", "rejected"]:
        return jsonify({"error": "Invalid status"}), 400

    try:
        res = supabase.table("bookings")\
            .update({"status": new_status, "updated_at": "now()"})\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .eq("status", "pending")\
            .execute()

        if not res.data:
            return jsonify({"error": "Booking not found, not pending, or not yours"}), 403

        return jsonify({"message": f"Booking {new_status}"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/seller/conversations
# List conversations (bookings + last message + unread)
# ────────────────────────────────────────────────
@bp.route("/conversations", methods=["GET"])
@jwt_required()
def seller_conversations():
    seller_id = get_jwt_identity()

    try:
        bookings_res = supabase.table("bookings")\
            .select("""
                id, status, start_time,
                buyer:buyer_id (full_name, avatar_url)
            """)\
            .eq("seller_id", seller_id)\
            .order("start_time", desc=True)\
            .execute()

        conversations = []
        for b in (bookings_res.data or []):
            # Last message
            last_msg_res = supabase.table("messages")\
                .select("content, created_at")\
                .eq("booking_id", b["id"])\
                .order("created_at", desc=True)\
                .limit(1)\
                .maybe_single().execute()

            last_msg = last_msg_res.data or {}

            # Unread count
            unread_res = supabase.table("messages")\
                .select("id", count="exact")\
                .eq("booking_id", b["id"])\
                .eq("receiver_id", seller_id)\
                .is_("read_at", True)\
                .execute()

            conversations.append({
                "id": b["id"],
                "client_name": b["buyer"]["full_name"] if b["buyer"] else "Client",
                "client_avatar": b["buyer"]["avatar_url"],
                "last_message": last_msg.get("content", "New booking request"),
                "last_message_time": last_msg.get("created_at") or b["start_time"],
                "unread_count": unread_res.count or 0,
                "status": b["status"]
            })

        return jsonify(conversations), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# GET /api/seller/verification
# Get current verification status (for own profile)
# ────────────────────────────────────────────────
@bp.route("/verification", methods=["GET"])
@jwt_required()
def get_verification():
    seller_id = get_jwt_identity()

    try:
        res = supabase.table("verifications")\
            .select("id, status, evidence_urls, submitted_at, rejection_reason")\
            .eq("seller_id", seller_id)\
            .order("submitted_at", desc=True)\
            .limit(1)\
            .maybe_single().execute()

        if not res.data:
            return jsonify(None), 200  # no verification yet

        return jsonify(res.data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ────────────────────────────────────────────────
# PATCH /api/seller/bookings/:id/cancel
# Seller-initiated cancellation (only if not completed)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/cancel", methods=["PATCH"])
@jwt_required()
def seller_cancel_booking(id):
    seller_id = get_jwt_identity()
    data = request.get_json()
    reason = data.get("reason", "").strip()

    if len(reason) < 10:
        return jsonify({"error": "Reason must be ≥10 characters"}), 400

    try:
        res = supabase.table("bookings")\
            .update({
                "status": "cancelled",
                "cancel_reason": f"Seller: {reason}",
                "updated_at": "now()"
            })\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .not_.in_("status", ["completed", "cancelled"])\
            .execute()

        if not res.data:
            return jsonify({"error": "Booking not found or cannot be cancelled"}), 403

        return jsonify({"message": "Booking cancelled by seller"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# POST /api/seller/payout/request
# Request earnings withdrawal
# ────────────────────────────────────────────────
@bp.route("/payout/request", methods=["POST"])
@jwt_required()
def request_payout():
    seller_id = get_jwt_identity()
    data = request.get_json()
    amount = data.get("amount")

    if not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    try:
        # Check available balance (simplified)
        earnings = supabase.table("bookings")\
            .select("price")\
            .eq("seller_id", seller_id)\
            .eq("status", "completed")\
            .execute().data or []

        total_earned = sum(b["price"] or 0 for b in earnings)
        # Assume you have a payouts table or balance field
        # Here we just simulate

        if amount > total_earned:
            return jsonify({"error": "Insufficient earnings"}), 400

        payout = {
            "seller_id": seller_id,
            "amount": amount,
            "status": "pending",
            "requested_at": "now()"
        }

        res = supabase.table("payouts").insert(payout).execute()

        if not res.data:
            return jsonify({"error": "Failed to request payout"}), 500

        return jsonify({"message": "Payout requested", "payout_id": res.data[0]["id"]}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500