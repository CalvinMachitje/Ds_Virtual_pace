# app/routes/seller.py
from asyncio.log import logger
from functools import wraps
from flask import Blueprint, app, app, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_limiter import Limiter
import flask_limiter
from postgrest import APIError
import postgrest
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

def seller_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        profile = supabase.table("profiles")\
            .select("role")\
            .eq("id", user_id)\
            .maybe_single()\
            .execute()

        if not profile.data or profile.data.get("role") != "seller":
            return jsonify({"error": "Seller access required"}), 403

        return f(*args, **kwargs)
    return decorated

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
            .maybe_single().execute().data

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
# GET /api/seller/profile
# Get the current authenticated seller's own profile (full details)
# Includes rating & review count
# ────────────────────────────────────────────────
@bp.route("/profile", methods=["GET"])
@jwt_required()
def get_seller_profile():
    seller_id = get_jwt_identity()

    try:
        # Fetch profile
        profile_res = supabase.table("profiles")\
            .select("id, full_name, phone, email, role, avatar_url, bio, created_at, updated_at")\
            .eq("id", seller_id)\
            .maybe_single().execute()

        if not profile_res.data:
            return jsonify({"error": "Profile not found"}), 404

        profile = profile_res.data

        # Get rating & review count
        reviews_res = supabase.table("reviews")\
            .select("rating")\
            .eq("reviewed_id", seller_id)\
            .execute()

        review_count = len(reviews_res.data or [])
        avg_rating = sum(r["rating"] for r in (reviews_res.data or [])) / review_count if review_count else 0.0

        return jsonify({
            **profile,
            "average_rating": round(avg_rating, 1),
            "review_count": review_count
        }), 200

    except Exception as e:
        current_app.logger.exception(f"Seller profile fetch error (seller {seller_id})")
        return jsonify({"error": "Failed to load profile"}), 500


# ────────────────────────────────────────────────
# PATCH /api/seller/profile
# Allowed fields: full_name, phone, bio, avatar_url
# ────────────────────────────────────────────────
@bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_seller_profile():
    seller_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    # Only allow specific fields
    allowed_fields = ["full_name", "phone", "bio", "avatar_url"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

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
        update_data["bio"] = bio if bio else None

    try:
        # Update profile
        res = supabase.table("profiles")\
            .update({**update_data, "updated_at": "now()"})\
            .eq("id", seller_id)\
            .execute()

        if not res.data:
            return jsonify({"error": "Profile not found or update failed"}), 404

        updated_profile = res.data[0]

        current_app.logger.info(f"Seller {seller_id} updated profile fields: {list(update_data.keys())}")

        return jsonify({
            "message": "Profile updated successfully",
            "profile": {
                "id": updated_profile["id"],
                "full_name": updated_profile["full_name"],
                "phone": updated_profile["phone"],
                "email": updated_profile["email"],
                "role": updated_profile["role"],
                "avatar_url": updated_profile["avatar_url"],
                "bio": updated_profile["bio"],
                "updated_at": updated_profile["updated_at"]
            }
        }), 200

    except Exception as e:
        current_app.logger.exception(f"Seller profile update error (seller {seller_id})")
        return jsonify({"error": "Failed to update profile"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/verification
# ────────────────────────────────────────────────
@bp.route("/verification", methods=["GET"])
@jwt_required()
def get_verification():
    seller_id = get_jwt_identity()

    try:
        # Execute the query
        res = supabase.table("verifications")\
            .select("id, status, evidence_urls, submitted_at, rejection_reason, reviewed_by, reviewed_at")\
            .eq("seller_id", seller_id)\
            .order("submitted_at", desc=True)\
            .limit(1)\
            .maybe_single()\
            .execute()

        # Safety check: if res is None or malformed → treat as no verification
        if res is None:
            current_app.logger.warning(f"Supabase returned None for verification query (seller {seller_id})")
            return jsonify(None), 200

        # Normal case: check for no-content (204) or empty data
        if hasattr(res, 'code') and res.code == "204" or not getattr(res, 'data', None):
            return jsonify(None), 200

        # Success: return the data
        return jsonify(res.data), 200

    except postgrest.exceptions.APIError as api_err:
        if api_err.code == "204":
            return jsonify(None), 200
        current_app.logger.exception(f"PostgREST API error fetching verification for {seller_id}")
        return jsonify({"error": "Failed to load verification status"}), 500

    except Exception as e:
        current_app.logger.exception(f"Verification fetch failed for seller {seller_id}")
        return jsonify({
            "error": "Internal server error while loading verification",
            "details": str(e) if current_app.debug else None
        }), 500

@bp.route("/verification", methods=["POST"])
@jwt_required()
def submit_verification():
    seller_id = get_jwt_identity()

    if "files" not in request.files:
        return jsonify({"error": "No files provided"}), 400

    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files selected"}), 400

    evidence_urls = []
    bucket = "verifications"

    try:
        for file in files:
            if file.filename == "" or not allowed_file(file.filename):
                continue

            filename = secure_filename(f"{seller_id}_{uuid.uuid4().hex}_{file.filename}")
            path = f"{seller_id}/{filename}"

            # Upload to Supabase Storage
            upload_res = supabase.storage.from_(bucket).upload(
                path=path,
                file=file.read(),
                file_options={"cacheControl": "3600", "upsert": "true"}
            )

            if upload_res.status_code not in (200, 201):
                logger.warning(f"Storage upload failed: {upload_res}")
                continue

            public_url = supabase.storage.from_(bucket).get_public_url(path)
            evidence_urls.append(public_url)

        if not evidence_urls:
            return jsonify({"error": "No valid files uploaded"}), 400

        # Create verification record
        verification = {
            "seller_id": seller_id,
            "status": "pending",
            "evidence_urls": evidence_urls,
            "submitted_at": "now()",
            "created_at": "now()",
            "updated_at": "now()"
        }

        res = supabase.table("verifications").insert(verification).execute()

        if not res.data:
            return jsonify({"error": "Failed to submit verification"}), 500

        return jsonify({
            "message": "Verification submitted successfully",
            "verification_id": res.data[0]["id"]
        }), 201

    except Exception as e:
        logger.exception(f"Verification submission failed for seller {seller_id}")
        return jsonify({"error": "Failed to submit verification"}), 500

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

    
# =============================================================================
# AVAILABILITY – Seller manages own slots
# =============================================================================

@bp.route("/availability", methods=["GET"])
@seller_required
def list_availability():
    user_id = get_jwt_identity()
    try:
        slots = supabase.table("seller_availability")\
            .select("*")\
            .eq("seller_id", user_id)\
            .order("start_time")\
            .execute().data or []
        return jsonify(slots), 200

    except Exception as e:
        logger.error(f"Availability list failed: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to load availability",
            "debug": str(e) if current_app.debug else None
        }), 500


@bp.route("/availability", methods=["POST"])
@seller_required
def create_availability():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    required = ["start_time", "end_time"]
    if not all(k in data for k in required):
        return jsonify({"error": "start_time and end_time required"}), 400

    try:
        start = data["start_time"]
        end = data["end_time"]

        if end <= start:
            return jsonify({"error": "end_time must be after start_time"}), 400

        notes = data.get("notes")
        if notes is not None:
            notes = str(notes).strip() or None  # safe strip

        slot = {
            "seller_id": user_id,
            "start_time": start,
            "end_time": end,
            "notes": notes,
            "is_booked": False,
            "created_at": "now()",
            "updated_at": "now()"
        }

        inserted = supabase.table("seller_availability").insert(slot).execute()

        if not inserted.data:
            return jsonify({"error": "Failed to create slot"}), 500

        logger.info(f"Seller {user_id} added availability slot")
        return jsonify(inserted.data[0]), 201

    except Exception as e:
        logger.error(f"Create availability failed: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to add slot",
            "debug": str(e) if current_app.debug else None
        }), 500


@bp.route("/availability/<slot_id>", methods=["DELETE"])
@seller_required
def delete_availability(slot_id):
    """Delete an availability slot (only if not booked)"""
    user_id = get_jwt_identity()

    try:
        slot = supabase.table("seller_availability")\
            .select("seller_id, is_booked")\
            .eq("id", slot_id)\
            .maybe_single()\
            .execute()

        if not slot.data:
            return jsonify({"error": "Slot not found"}), 404

        if slot.data["seller_id"] != user_id:
            return jsonify({"error": "Not your slot"}), 403

        if slot.data["is_booked"]:
            return jsonify({"error": "Cannot delete booked slot"}), 400

        supabase.table("seller_availability").delete().eq("id", slot_id).execute()

        logger.info(f"Seller {user_id} deleted availability slot {slot_id}")
        return jsonify({"message": "Slot deleted"}), 200

    except Exception as e:
        logger.error(f"Delete availability failed: {str(e)}")
        return jsonify({"error": "Failed to delete slot"}), 500
    
@bp.route("/debug/supabase", methods=["GET"])
def debug_supabase():
    status = supabase.check_connection()
    return jsonify(status), 200

@bp.route("/offers", methods=["GET"])
@seller_required
def get_my_offers():
    user_id = get_jwt_identity()
    try:
        offers = supabase.table("service_offers")\
            .select("*, job_requests!request_id (title, description, budget, category)")\
            .eq("seller_id", user_id)\
            .eq("status", "pending")\
            .order("created_at", desc=True)\
            .execute().data or []
        return jsonify(offers), 200
    except Exception as e:
        logger.error(f"Get offers failed: {str(e)}")
        return jsonify({"error": "Failed to load offers"}), 500


@bp.route("/offers/<offer_id>/respond", methods=["PATCH"])
@seller_required
def respond_to_offer(offer_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    action = data.get("action")  # "accept" or "reject"

    if action not in ["accept", "reject"]:
        return jsonify({"error": "action must be 'accept' or 'reject'"}), 400

    try:
        offer = supabase.table("service_offers")\
            .select("id, request_id, status, seller_id")\
            .eq("id", offer_id)\
            .maybe_single()\
            .execute()

        if not offer.data or offer.data["seller_id"] != user_id:
            return jsonify({"error": "Offer not found or not yours"}), 404

        if offer.data["status"] != "pending":
            return jsonify({"error": "Offer already processed"}), 400

        # Update offer status
        supabase.table("service_offers")\
            .update({"status": "accepted" if action == "accept" else "rejected"})\
            .eq("id", offer_id)\
            .execute()

        if action == "accept":
            # Create booking
            request_data = supabase.table("service_requests")\
                .select("buyer_id, category, title, budget")\
                .eq("id", offer.data["request_id"])\
                .single()\
                .execute().data

            booking = {
                "buyer_id": request_data["buyer_id"],
                "seller_id": user_id,
                "service": request_data["title"],
                "price": request_data["budget"],
                "status": "accepted",
                "created_at": "now()",
                "updated_at": "now()"
            }

            booking_res = supabase.table("bookings").insert(booking).execute()

            # Update request to accepted
            supabase.table("service_requests")\
                .update({"status": "accepted"})\
                .eq("id", offer.data["request_id"])\
                .execute()

            return jsonify({
                "message": "Offer accepted – booking created",
                "booking_id": booking_res.data[0]["id"]
            }), 200

        else:
            # Update request back to pending or rejected
            supabase.table("service_requests")\
                .update({"status": "pending"})\
                .eq("id", offer.data["request_id"])\
                .execute()

            return jsonify({"message": "Offer rejected"}), 200

    except Exception as e:
        logger.error(f"Respond to offer failed: {str(e)}")
        return jsonify({"error": "Server error"}), 500
    
# ────────────────────────────────────────────────
# GET /api/seller/conversations
# List all conversations for the authenticated seller
# ────────────────────────────────────────────────
@bp.route("/conversations", methods=["GET"])
@jwt_required()
def get_seller_conversations():
    seller_id = get_jwt_identity()

    try:
        res = supabase.table("messages")\
            .select("""
                id,
                sender_id,
                receiver_id,
                content,
                created_at,
                sender:profiles!sender_id (full_name, avatar_url),
                receiver:profiles!receiver_id (full_name, avatar_url)
            """)\
            .or_(f"sender_id.eq.{seller_id},receiver_id.eq.{seller_id}")\
            .order("created_at", desc=True)\
            .execute()

        conversations = []
        seen = set()

        for msg in (res.data or []):
            other_id = msg["sender_id"] if msg["receiver_id"] == seller_id else msg["receiver_id"]
            if other_id in seen:
                continue
            seen.add(other_id)

            other_profile = msg["sender"] if msg["receiver_id"] == seller_id else msg["receiver"]
            conversations.append({
                "id": other_id,
                "client_name": other_profile["full_name"] or "Unknown",
                "client_avatar": other_profile["avatar_url"],
                "last_message": msg["content"],
                "last_message_time": msg["created_at"],
                "unread_count": 0,  # TODO: implement unread count logic
                "status": "active"   # TODO: derive from booking status if linked
            })

        return jsonify(conversations), 200

    except Exception as e:
        logger.exception(f"Seller conversations fetch failed for {seller_id}")
        return jsonify({"error": "Failed to load conversations"}), 500


# ────────────────────────────────────────────────
# GET /api/seller/messages/conversation/<conversation_id>
# Get message history for a specific seller-buyer conversation
# ────────────────────────────────────────────────
@bp.route("/messages/conversation/<string:conversation_id>", methods=["GET"])
@jwt_required()
def get_seller_chat_history(conversation_id):
    seller_id = get_jwt_identity()
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    try:
        # Verify seller is part of this conversation
        participant = supabase.table("messages")\
            .select("id")\
            .or_(f"sender_id.eq.{seller_id},receiver_id.eq.{seller_id}")\
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
            .or_(f"sender_id.eq.{seller_id},receiver_id.eq.{seller_id}")\
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
                "is_sent_by_me": msg["sender_id"] == seller_id
            })

        return jsonify(formatted), 200

    except Exception as e:
        logger.exception(f"Seller chat history error for {conversation_id}")
        return jsonify({"error": "Failed to load messages"}), 500
    

# ────────────────────────────────────────────────
# GET /api/seller/<user_id>/reviews   
# Public endpoint: Get all reviews for a user (seller or buyer)
@bp.route("/profile/<string:user_id>/reviews", methods=["GET"])
def get_profile_reviews(user_id: str):
    """
    Public endpoint: Get reviews for any user (usually sellers)
    Uses explicit join hint to avoid schema cache issues
    """
    try:
        # Use explicit !reviewer_id hint to force relationship
        res = supabase.table("reviews")\
            .select("""
                id,
                rating,
                comment,
                created_at,
                reviewer:profiles!reviews_reviewer_id_fkey (full_name, avatar_url)
            """)\
            .eq("reviewed_id", user_id)\
            .order("created_at", desc=True)\
            .execute()

        reviews = res.data or []

        # Fallback if reviewer missing (safety)
        for review in reviews:
            reviewer = review.get("reviewer") or {}
            if not reviewer:
                review["reviewer"] = {
                    "full_name": "Anonymous",
                    "avatar_url": None
                }

        # Calculate average rating
        avg_rating = None
        if reviews:
            avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1)

        return jsonify({
            "reviews": reviews,
            "average_rating": avg_rating,
            "total_reviews": len(reviews)
        }), 200

    except postgrest.exceptions.APIError as e:
        if e.code == "PGRST200":
            # Fallback to non-joined query if relationship still broken
            logger.warning("Relationship hint failed - falling back to basic query")
            fallback = supabase.table("reviews")\
                .select("id, rating, comment, created_at")\
                .eq("reviewed_id", user_id)\
                .order("created_at", desc=True)\
                .execute()

            return jsonify({
                "reviews": fallback.data or [],
                "average_rating": None,
                "total_reviews": len(fallback.data or []),
                "warning": "Reviewer details unavailable - schema issue"
            }), 200

        logger.exception(f"Reviews API error for user {user_id}")
        return jsonify({"error": "Failed to load reviews"}), 500

    except Exception as e:
        logger.exception(f"Reviews fetch failed for user {user_id}")
        return jsonify({"error": "Internal error loading reviews"}), 500