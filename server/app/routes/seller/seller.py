# app/routes/seller.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import uuid
import os

bp = Blueprint("seller", __name__, url_prefix="/api/seller")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

# In-memory rate limit per seller (demo) — use Flask-Limiter in production
image_upload_attempts = {}  # {seller_id: last_upload_time}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ────────────────────────────────────────────────
# POST /api/seller/gigs
# Create new gig (seller only)
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

    # Input validation
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
        current_app.logger.error(f"Gig creation error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to create gig"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/gigs
# List current seller's gigs (paginated)
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

        return jsonify({
            "gigs": res.data or [],
            "total": res.count or 0,
            "page": page,
            "per_page": per_page,
            "has_more": len(res.data or []) == per_page
        }), 200

    except Exception as e:
        current_app.logger.error(f"List gigs error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to load gigs"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/gigs/:id
# Get single gig (owner only)
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
        current_app.logger.error(f"Get gig error (seller {seller_id}, gig {id}): {str(e)}")
        return jsonify({"error": "Failed to load gig"}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/gigs/:id
# Update gig (owner only, limited fields)
# ────────────────────────────────────────────────
@bp.route("/gigs/<string:id>", methods=["PATCH"])
@jwt_required()
def update_seller_gig(id):
    seller_id = get_jwt_identity()
    data = request.get_json()

    allowed_fields = ["title", "category", "description", "price", "gallery_urls", "status"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400

    # Basic validation on updated fields
    if "title" in update_data and (len(update_data["title"]) < 8 or len(update_data["title"]) > 80):
        return jsonify({"error": "Title must be 8–80 characters"}), 400

    if "description" in update_data and (len(update_data["description"]) < 120 or len(update_data["description"]) > 5000):
        return jsonify({"error": "Description must be 120–5000 characters"}), 400

    if "price" in update_data and (not isinstance(update_data["price"], (int, float)) or update_data["price"] < 50 or update_data["price"] > 2000):
        return jsonify({"error": "Price must be between R50 and R2000"}), 400

    try:
        res = supabase.table("gigs")\
            .update(update_data)\
            .eq("id", id)\
            .eq("seller_id", seller_id)\
            .execute()

        if not res.data:
            return jsonify({"error": "Gig not found or not yours"}), 404

        return jsonify({"message": "Gig updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Update gig error (seller {seller_id}, gig {id}): {str(e)}")
        return jsonify({"error": "Failed to update gig"}), 500


# ────────────────────────────────────────────────
# DELETE /api/seller/gigs/:id
# Delete gig (owner only)
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
            return jsonify({"error": "Gig not found or not owned by you"}), 404

        return jsonify({"message": "Gig deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Delete gig error (seller {seller_id}, gig {id}): {str(e)}")
        return jsonify({"error": "Failed to delete gig"}), 500


# ────────────────────────────────────────────────
# POST /api/seller/gig-images
# Upload gig gallery images (rate-limited, user-specific path)
# ────────────────────────────────────────────────
@bp.route("/gig-images", methods=["POST"])
@jwt_required()
def upload_gig_images():
    seller_id = get_jwt_identity()

    # Rate limit: 1 upload batch per 10 minutes
    last_upload = image_upload_attempts.get(seller_id)
    if last_upload and (datetime.utcnow() - last_upload).total_seconds() < 600:
        return jsonify({"error": "Please wait 10 minutes before uploading more images"}), 429

    if "images" not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images selected"}), 400

    uploaded_urls = []

    for file in files:
        if file.filename == "" or not allowed_file(file.filename):
            continue

        file_content = file.read()
        if len(file_content) > MAX_IMAGE_SIZE:
            return jsonify({"error": f"Image {file.filename} too large (max 5MB)"}), 400

        file.seek(0)

        try:
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = secure_filename(f"{seller_id}_{uuid.uuid4().hex}.{ext}")
            path = f"gig-gallery/{seller_id}/{filename}"  # user-specific folder

            upload_res = supabase.storage.from_("gig-gallery").upload(
                path=path,
                file=file_content,
                file_options={"cacheControl": "3600", "upsert": "true"}
            )

            if upload_res.status_code not in (200, 201):
                current_app.logger.warning(f"Storage upload failed for {path}")
                continue

            public_url = supabase.storage.from_("gig-gallery").get_public_url(path)
            uploaded_urls.append(public_url)

        except Exception as e:
            current_app.logger.error(f"Gig image upload error (seller {seller_id}): {str(e)}")
            continue

    # Update rate limit
    image_upload_attempts[seller_id] = datetime.utcnow()

    return jsonify({
        "message": f"{len(uploaded_urls)} image(s) uploaded successfully",
        "urls": uploaded_urls
    }), 200


# ────────────────────────────────────────────────
# POST /api/seller/portfolio-images
# Upload portfolio images (rate-limited, user-specific path)
# ────────────────────────────────────────────────
@bp.route("/portfolio-images", methods=["POST"])
@jwt_required()
def upload_portfolio_images():
    seller_id = get_jwt_identity()

    # Rate limit: same as gig images
    last_upload = image_upload_attempts.get(seller_id)
    if last_upload and (datetime.utcnow() - last_upload).total_seconds() < 600:
        return jsonify({"error": "Please wait 10 minutes before uploading more images"}), 429

    if "images" not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images selected"}), 400

    uploaded_urls = []

    for file in files:
        if file.filename == "" or not allowed_file(file.filename):
            continue

        file_content = file.read()
        if len(file_content) > MAX_IMAGE_SIZE:
            return jsonify({"error": f"Image {file.filename} too large (max 5MB)"}), 400

        file.seek(0)

        try:
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = secure_filename(f"portfolio_{seller_id}_{uuid.uuid4().hex}.{ext}")
            path = f"portfolio-images/{seller_id}/{filename}"

            upload_res = supabase.storage.from_("portfolio-images").upload(
                path=path,
                file=file_content,
                file_options={"cacheControl": "3600", "upsert": "true"}
            )

            if upload_res.status_code not in (200, 201):
                current_app.logger.warning(f"Portfolio upload failed for {path}")
                continue

            public_url = supabase.storage.from_("portfolio-images").get_public_url(path)
            uploaded_urls.append(public_url)

        except Exception as e:
            current_app.logger.error(f"Portfolio image upload error (seller {seller_id}): {str(e)}")
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

    # Update rate limit
    image_upload_attempts[seller_id] = datetime.utcnow()

    return jsonify({
        "message": f"{len(uploaded_urls)} portfolio image(s) uploaded successfully",
        "urls": uploaded_urls
    }), 200


# ────────────────────────────────────────────────
# GET /api/seller/dashboard
# Seller stats (gigs, bookings, earnings, rating)
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
            .in_("status", ["pending", "accepted", "in_progress"])\
            .execute().count or 0

        # Completed bookings
        completed_bookings = supabase.table("bookings")\
            .select("id", count="exact")\
            .eq("seller_id", seller_id)\
            .eq("status", "completed")\
            .execute().count or 0

        # Rating & review count
        reviews_res = supabase.table("reviews")\
            .select("rating")\
            .eq("reviewed_id", seller_id)\
            .execute()

        review_count = len(reviews_res.data or [])
        avg_rating = sum(r["rating"] for r in (reviews_res.data or [])) / review_count if review_count else 0

        # Monthly earnings (current month)
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
        current_app.logger.error(f"Seller dashboard error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to load dashboard"}), 500


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
                buyer:buyer_id (id, full_name, avatar_url)
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
                "buyer": row["buyer"] or {"full_name": "Unknown", "avatar_url": None}
            })

        return jsonify(bookings), 200

    except Exception as e:
        current_app.logger.error(f"Seller bookings error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to load bookings"}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/bookings/:id/status
# Update booking status (accept/reject/only pending)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/status", methods=["PATCH"])
@jwt_required()
def update_booking_status(id):
    seller_id = get_jwt_identity()
    data = request.get_json()
    new_status = data.get("status")

    if new_status not in ["accepted", "rejected"]:
        return jsonify({"error": "Invalid status. Must be 'accepted' or 'rejected'"}), 400

    try:
        booking = supabase.table("bookings")\
            .select("id, status, seller_id")\
            .eq("id", id)\
            .maybe_single().execute()

        if not booking.data:
            return jsonify({"error": "Booking not found"}), 404

        if booking.data["seller_id"] != seller_id:
            return jsonify({"error": "Unauthorized"}), 403

        if booking.data["status"] != "pending":
            return jsonify({"error": "Only pending bookings can be updated"}), 400

        supabase.table("bookings")\
            .update({
                "status": new_status,
                "updated_at": "now()"
            })\
            .eq("id", id)\
            .execute()

        return jsonify({"message": f"Booking {new_status} successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Booking status update error (seller {seller_id}, booking {id}): {str(e)}")
        return jsonify({"error": "Failed to update booking status"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/conversations
# List seller conversations (bookings + last message + unread)
# ────────────────────────────────────────────────
@bp.route("/conversations", methods=["GET"])
@jwt_required()
def seller_conversations():
    seller_id = get_jwt_identity()

    try:
        bookings_res = supabase.table("bookings")\
            .select("""
                id, status, start_time,
                buyer:buyer_id (id, full_name, avatar_url)
            """)\
            .eq("seller_id", seller_id)\
            .order("start_time", desc=True)\
            .execute()

        conversations = []
        for b in (bookings_res.data or []):
            last_msg_res = supabase.table("messages")\
                .select("content, created_at")\
                .eq("booking_id", b["id"])\
                .order("created_at", desc=True)\
                .limit(1).maybe_single().execute()

            last_msg = last_msg_res.data or {}

            unread_res = supabase.table("messages")\
                .select("id", count="exact")\
                .eq("booking_id", b["id"])\
                .eq("receiver_id", seller_id)\
                .is_("read_at", None)\
                .execute()

            conversations.append({
                "id": b["id"],
                "client": {
                    "id": b["buyer"]["id"],
                    "name": b["buyer"]["full_name"] or "Client",
                    "avatar": b["buyer"]["avatar_url"]
                },
                "last_message": last_msg.get("content", "New booking request"),
                "last_message_time": last_msg.get("created_at") or b["start_time"],
                "unread_count": unread_res.count or 0,
                "status": b["status"]
            })

        return jsonify(conversations), 200

    except Exception as e:
        current_app.logger.error(f"Seller conversations error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to load conversations"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/verification
# Get current seller verification status
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

        return jsonify(res.data or None), 200

    except Exception as e:
        current_app.logger.error(f"Verification fetch error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to load verification status"}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/bookings/:id/cancel
# Seller cancel booking (only if not completed)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/cancel", methods=["PATCH"])
@jwt_required()
def seller_cancel_booking(id):
    seller_id = get_jwt_identity()
    data = request.get_json()
    reason = data.get("reason", "").strip()

    if len(reason) < 10:
        return jsonify({"error": "Cancellation reason must be at least 10 characters"}), 400

    try:
        booking = supabase.table("bookings")\
            .select("id, status, seller_id")\
            .eq("id", id)\
            .maybe_single().execute()

        if not booking.data:
            return jsonify({"error": "Booking not found"}), 404

        if booking.data["seller_id"] != seller_id:
            return jsonify({"error": "Unauthorized"}), 403

        if booking.data["status"] in ["completed", "cancelled"]:
            return jsonify({"error": "Booking cannot be cancelled in this status"}), 400

        supabase.table("bookings")\
            .update({
                "status": "cancelled",
                "cancel_reason": f"Seller: {reason}",
                "updated_at": "now()"
            })\
            .eq("id", id)\
            .execute()

        return jsonify({"message": "Booking cancelled by seller"}), 200

    except Exception as e:
        current_app.logger.error(f"Seller cancel booking error (seller {seller_id}, booking {id}): {str(e)}")
        return jsonify({"error": "Failed to cancel booking"}), 500


# ────────────────────────────────────────────────
# POST /api/seller/payout/request
# Request payout (basic validation)
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
        # Check total completed earnings
        earnings = supabase.table("bookings")\
            .select("price")\
            .eq("seller_id", seller_id)\
            .eq("status", "completed")\
            .execute().data or []

        total_earned = sum(b["price"] or 0 for b in earnings)

        if amount > total_earned:
            return jsonify({"error": "Requested amount exceeds available earnings"}), 400

        # TODO: check pending payouts / minimum threshold etc.

        payout = {
            "seller_id": seller_id,
            "amount": amount,
            "status": "pending",
            "requested_at": "now()"
        }

        res = supabase.table("payouts").insert(payout).execute()

        if not res.data:
            return jsonify({"error": "Failed to request payout"}), 500

        return jsonify({
            "message": "Payout request submitted",
            "payout_id": res.data[0]["id"]
        }), 201

    except Exception as e:
        current_app.logger.error(f"Payout request error (seller {seller_id}): {str(e)}")
        return jsonify({"error": "Failed to request payout"}), 500