# app/routes/shared.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from app.services.supabase_service import supabase
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

bp = Blueprint("shared", __name__, url_prefix="/api")

# ────────────────────────────────────────────────
# GET /api/gigs
# List published gigs (with pagination, filters)
# ────────────────────────────────────────────────
@bp.route("/gigs", methods=["GET"])
def list_gigs():
    page = request.args.get("page", 0, type=int)
    limit = request.args.get("limit", 9, type=int)
    search = request.args.get("search", "").strip()
    category = request.args.get("category")
    min_rating = request.args.get("min_rating", 0, type=float)
    max_price = request.args.get("max_price", None, type=float)
    sort = request.args.get("sort", "newest")

    from_idx = page * limit
    to_idx = from_idx + limit - 1

    try:
        query = supabase.table("gigs")\
            .select("""
                id, title, description, price, category, created_at, image_url, available,
                profiles!gigs_seller_id_fkey (full_name, rating, review_count)
            """)\
            .eq("status", "published")

        if search:
            query = query.or_(
                f"title.ilike.%{search}%,description.ilike.%{search}%"
            )

        if category:
            query = query.eq("category", category)

        if min_rating > 0:
            query = query.gte("profiles.rating", min_rating)

        if max_price is not None:
            query = query.lte("price", max_price)

        # Sorting
        if sort == "price-low":
            query = query.order("price", desc=False)
        elif sort == "price-high":
            query = query.order("price", desc=True)
        elif sort == "rating-high":
            query = query.order("profiles.rating", desc=True)
        else:  # newest
            query = query.order("created_at", desc=True)

        res = query.range(from_idx, to_idx).execute()

        gigs = []
        for row in res.data or []:
            profile = row.pop("profiles", {}) or {}
            gigs.append({
                **row,
                "seller_name": profile.get("full_name", "Unknown Seller"),
                "rating": profile.get("rating", 0),
                "review_count": profile.get("review_count", 0),
            })

        return jsonify({
            "gigs": gigs,
            "nextPage": page + 1 if len(gigs) == limit else None,
            "totalCount": res.count or 0
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching gigs: {str(e)}")
        return jsonify({"error": "Failed to load gigs"}), 500


# ────────────────────────────────────────────────
# GET /api/gigs/:id
# Get single gig details (public)
# ────────────────────────────────────────────────
@bp.route("/gigs/<string:id>", methods=["GET"])
def get_gig(id):
    try:
        res = supabase.table("gigs")\
            .select("""
                id, title, description, price, category, created_at, image_url,
                seller_id,
                profiles!seller_id (full_name, avatar_url, is_verified, rating, review_count)
            """)\
            .eq("id", id)\
            .eq("status", "published")\
            .maybe_single().execute()

        if not res.data:
            return jsonify({"error": "Gig not found or not published"}), 404

        profile = res.data.pop("profiles", {}) or {}
        gig = {
            **res.data,
            "seller_name": profile.get("full_name", "Unknown"),
            "seller_avatar_url": profile.get("avatar_url"),
            "seller_is_verified": profile.get("is_verified", False),
            "rating": profile.get("rating", 0),
            "review_count": profile.get("review_count", 0),
        }

        return jsonify(gig), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching gig {id}: {str(e)}")
        return jsonify({"error": "Failed to load gig"}), 500


# ────────────────────────────────────────────────
# GET /api/categories/:category
# Sellers + gigs in a specific category (used in CategoryPage)
# ────────────────────────────────────────────────
@bp.route("/categories/<string:category>", methods=["GET"])
def category_sellers(category):
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)
    min_rating = request.args.get("min_rating", 0, type=float)
    max_price = request.args.get("max_price", None, type=float)
    search = request.args.get("search", "").strip()

    try:
        # Fetch gigs in category → group by seller
        query = supabase.table("gigs")\
            .select("""
                id, title, description, price, seller_id,
                profiles!seller_id (id, full_name, avatar_url, rating, is_verified, is_online)
            """)\
            .eq("status", "published")\
            .ilike("category", f"%{category}%")

        if search:
            query = query.or_(
                f"title.ilike.%{search}%,profiles.full_name.ilike.%{search}%"
            )

        if min_rating > 0:
            query = query.gte("profiles.rating", min_rating)

        if max_price:
            query = query.lte("price", max_price)

        res = query.execute()

        grouped = {}
        for gig in res.data or []:
            seller = gig.pop("profiles", {}) or {}
            seller_id = gig["seller_id"]
            if seller_id not in grouped:
                grouped[seller_id] = {
                    "seller": {
                        "id": seller_id,
                        "full_name": seller.get("full_name", "Unknown"),
                        "avatar_url": seller.get("avatar_url"),
                        "rating": seller.get("rating", 0),
                        "is_verified": seller.get("is_verified", False),
                        "is_online": seller.get("is_online", False),
                    },
                    "gigs": [],
                    "reviewCount": 0,  # can be fetched separately if needed
                }
            grouped[seller_id]["gigs"].append({
                "id": gig["id"],
                "title": gig["title"],
                "description": gig["description"],
                "price": gig["price"],
            })

        result = list(grouped.values())

        # Pagination on grouped sellers
        start = (page - 1) * limit
        end = start + limit
        paginated = result[start:end]

        return jsonify({
            "sellers": paginated,
            "total": len(result),
            "page": page,
            "has_more": end < len(result)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Category error: {str(e)}")
        return jsonify({"error": "Failed to load category"}), 500


# ────────────────────────────────────────────────
# POST /api/bookings
# Create new booking request (from GigDetail)
# ────────────────────────────────────────────────
@bp.route("/bookings", methods=["POST"])
@jwt_required()
def create_booking():
    buyer_id = get_jwt_identity()
    data = request.get_json()

    gig_id = data.get("gig_id")
    note = data.get("note")

    if not gig_id:
        return jsonify({"error": "gig_id required"}), 400

    try:
        # Fetch gig to get seller & price
        gig = supabase.table("gigs")\
            .select("id, seller_id, price, title")\
            .eq("id", gig_id)\
            .eq("status", "published")\
            .maybe_single().execute().data

        if not gig:
            return jsonify({"error": "Gig not found or not available"}), 404

        booking = {
            "gig_id": gig_id,
            "buyer_id": buyer_id,
            "seller_id": gig["seller_id"],
            "price": gig["price"],
            "service": gig["title"],
            "note": note or None,
            "start_time": datetime.utcnow().isoformat(),
            "status": "pending",
            "created_at": "now()",
            "updated_at": "now()"
        }

        res = supabase.table("bookings").insert(booking).execute()

        if not res.data:
            return jsonify({"error": "Failed to create booking"}), 500

        return jsonify({
            "message": "Booking request sent",
            "booking_id": res.data[0]["id"]
        }), 201

    except Exception as e:
        current_app.logger.error(f"Booking creation error: {str(e)}")
        return jsonify({"error": "Failed to create booking"}), 500


# ────────────────────────────────────────────────
# GET /api/bookings/:id/review
# Get booking details for review/payment confirmation
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/review", methods=["GET"])
@jwt_required()
def review_booking(id):
    user_id = get_jwt_identity()

    try:
        res = supabase.table("bookings")\
            .select("""
                id, seller_id, price, service, start_time, duration,
                seller:profiles!seller_id (full_name, avatar_url)
            """)\
            .eq("id", id)\
            .eq("buyer_id", user_id)\
            .maybe_single().execute()

        if not res.data:
            return jsonify({"error": "Booking not found or not yours"}), 404

        booking = res.data
        seller = booking.pop("seller", {}) or {}

        return jsonify({
            **booking,
            "seller_name": seller.get("full_name", "Unknown"),
            "avatar_url": seller.get("avatar_url"),
            # Add fee/tax calculation if needed
            "fee": booking["price"] * 0.10,  # example 10%
            "taxes": booking["price"] * 0.15,  # example 15%
            "total": booking["price"] * 1.25,
            "payment_method": "Credit Card"  # mock or fetch from user
        }), 200

    except Exception as e:
        current_app.logger.error(f"Review booking error: {str(e)}")
        return jsonify({"error": "Failed to load booking"}), 500


# ────────────────────────────────────────────────
# GET /api/profiles/:id/verification
# Public verification status & trust info
# ────────────────────────────────────────────────
@bp.route("/profiles/<string:id>/verification", methods=["GET"])
def get_verification_status(id):
    try:
        profile = supabase.table("profiles")\
            .select("trust_score, jobs_done, rating")\
            .eq("id", id)\
            .maybe_single().execute().data

        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        # Mock credentials (can be replaced with real data from verifications/jobs table)
        credentials = [
            {"title": "Identity Verified", "desc": "Government ID verified", "icon": "UserCheck"},
            {"title": "Background Check", "desc": "Clear criminal record", "icon": "ShieldCheck"},
            {"title": "Skills Verified", "desc": "Top performer in category", "icon": "Star"},
            {"title": "Platform Certified", "desc": "Completed training", "icon": "CheckCircle2"},
        ]

        return jsonify({
            "trust_score": profile.get("trust_score", 85),
            "jobs_done": profile.get("jobs_done", 0),
            "rating": profile.get("rating", 0),
            "credentials": credentials
        }), 200

    except Exception as e:
        current_app.logger.error(f"Verification status error: {str(e)}")
        return jsonify({"error": "Failed to load verification"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/forgot-password
# Send password reset email
# ────────────────────────────────────────────────
@bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email required"}), 400

    try:
        # Use Supabase auth to send reset email
        res = supabase.auth.reset_password_for_email(
            email,
            redirect_to=f"{request.host_url}reset-password"
        )

        if res:
            return jsonify({"message": "Reset link sent to your email"}), 200
        else:
            return jsonify({"error": "Failed to send reset email"}), 500

    except Exception as e:
        current_app.logger.error(f"Forgot password error: {str(e)}")
        return jsonify({"error": "Failed to process request"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/reset-password
# Reset password with token
# ────────────────────────────────────────────────
@bp.route("/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    password = data.get("password")

    if not token or not password:
        return jsonify({"error": "Token and password required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    try:
        # Supabase handles token validation internally
        res = supabase.auth.update_user({"password": password})

        if res.user:
            return jsonify({"message": "Password reset successful"}), 200
        else:
            return jsonify({"error": "Invalid or expired token"}), 400

    except Exception as e:
        current_app.logger.error(f"Reset password error: {str(e)}")
        return jsonify({"error": "Failed to reset password"}), 500


# ────────────────────────────────────────────────
# GET /api/auth/session
# Get current session info (for Settings page)
# ────────────────────────────────────────────────
@bp.route("/auth/session", methods=["GET"])
@jwt_required()
def get_session():
    user_id = get_jwt_identity()

    try:
        profile = supabase.table("profiles")\
            .select("email, full_name, avatar_url, last_sign_in_at, provider")\
            .eq("id", user_id)\
            .single().execute().data

        if not profile:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "email": profile["email"],
            "full_name": profile["full_name"],
            "avatar_url": profile["avatar_url"],
            "last_sign_in_at": profile["last_sign_in_at"],
            "provider": profile["provider"] or "email"
        }), 200

    except Exception as e:
        current_app.logger.error(f"Session fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch session"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/logout
# Optional server-side logout (clear token blocklist if used)
# ────────────────────────────────────────────────
@bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    # If you implement JWT blocklist, add token here
    return jsonify({"message": "Logged out"}), 200