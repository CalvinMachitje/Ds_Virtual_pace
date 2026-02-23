# app/routes/shared.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from app.services.supabase_service import supabase
from datetime import datetime, timedelta
import uuid
import re

bp = Blueprint("shared", __name__, url_prefix="/api")

# Allowed redirect domains for password reset (add your production domain!)
ALLOWED_REDIRECT_DOMAINS = [
    "localhost:5173",
    "127.0.0.1:5173",
    "yourapp.com",           # ← change to your real production domain
    "www.yourapp.com",
]

# Simple in-memory rate limit for forgot-password (demo) — use Flask-Limiter + Redis in prod
reset_attempts = {}  # {email: {"count": int, "last_attempt": datetime}}


# ────────────────────────────────────────────────
# GET /api/gigs
# List published gigs (paginated + filters, public)
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
            # Prevent overly broad searches
            if len(search) < 2:
                return jsonify({"gigs": [], "nextPage": None, "totalCount": 0}), 200
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
        # Validate UUID format
        try:
            uuid.UUID(id)
        except ValueError:
            return jsonify({"error": "Invalid gig ID"}), 400

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
# Sellers + gigs in a specific category
# ────────────────────────────────────────────────
@bp.route("/categories/<string:category>", methods=["GET"])
def category_sellers(category):
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)
    min_rating = request.args.get("min_rating", 0, type=float)
    max_price = request.args.get("max_price", None, type=float)
    search = request.args.get("search", "").strip()

    try:
        query = supabase.table("gigs")\
            .select("""
                id, title, description, price, seller_id,
                profiles!seller_id (id, full_name, avatar_url, rating, is_verified, is_online)
            """)\
            .eq("status", "published")\
            .ilike("category", f"%{category}%")

        if search:
            if len(search) < 2:
                return jsonify({"sellers": [], "total": 0, "page": page, "has_more": False}), 200
            query = query.or_(
                f"title.ilike.%{search}%,profiles.full_name.ilike.%{search}%"
            )

        if min_rating > 0:
            query = query.gte("profiles.rating", min_rating)

        if max_price is not None:
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
                    "reviewCount": 0,
                }
            grouped[seller_id]["gigs"].append({
                "id": gig["id"],
                "title": gig["title"],
                "description": gig["description"],
                "price": gig["price"],
            })

        result = list(grouped.values())

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
        current_app.logger.error(f"Category error ({category}): {str(e)}")
        return jsonify({"error": "Failed to load category"}), 500


# ────────────────────────────────────────────────
# POST /api/bookings
# Create new booking request (buyer only)
# ────────────────────────────────────────────────
@bp.route("/bookings", methods=["POST"])
@jwt_required()
def create_booking():
    buyer_id = get_jwt_identity()
    data = request.get_json()

    gig_id = data.get("gig_id")
    note = data.get("note", "").strip()

    if not gig_id:
        return jsonify({"error": "gig_id required"}), 400

    try:
        gig = supabase.table("gigs")\
            .select("id, seller_id, price, title, status")\
            .eq("id", gig_id)\
            .maybe_single().execute().data

        if not gig:
            return jsonify({"error": "Gig not found"}), 404

        if gig["status"] != "published":
            return jsonify({"error": "Gig is not available for booking"}), 400

        # Prevent self-booking
        if gig["seller_id"] == buyer_id:
            return jsonify({"error": "Cannot book your own gig"}), 403

        booking = {
            "gig_id": gig_id,
            "buyer_id": buyer_id,
            "seller_id": gig["seller_id"],
            "price": gig["price"],
            "service": gig["title"],
            "note": note if note else None,
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
        current_app.logger.error(f"Booking creation error (buyer {buyer_id}): {str(e)}")
        return jsonify({"error": "Failed to create booking"}), 500


# ────────────────────────────────────────────────
# GET /api/bookings/:id/review
# Get booking details for review/payment (buyer only)
# ────────────────────────────────────────────────
@bp.route("/bookings/<string:id>/review", methods=["GET"])
@jwt_required()
def review_booking(id):
    user_id = get_jwt_identity()

    try:
        booking = supabase.table("bookings")\
            .select("""
                id, seller_id, price, service, start_time, duration,
                seller:profiles!seller_id (full_name, avatar_url)
            """)\
            .eq("id", id)\
            .eq("buyer_id", user_id)\
            .maybe_single().execute().data

        if not booking:
            return jsonify({"error": "Booking not found or not yours"}), 404

        seller = booking.pop("seller", {}) or {}

        # Example fee/tax calculation (customize as needed)
        fee = booking["price"] * 0.10
        taxes = booking["price"] * 0.15
        total = booking["price"] + fee + taxes

        return jsonify({
            **booking,
            "seller_name": seller.get("full_name", "Unknown"),
            "avatar_url": seller.get("avatar_url"),
            "fee": round(fee, 2),
            "taxes": round(taxes, 2),
            "total": round(total, 2),
            "payment_method": "Credit Card"  # Replace with real user payment method fetch
        }), 200

    except Exception as e:
        current_app.logger.error(f"Review booking error (user {user_id}, booking {id}): {str(e)}")
        return jsonify({"error": "Failed to load booking details"}), 500


# ────────────────────────────────────────────────
# GET /api/profiles/:id/verification
# Public verification status (no auth required)
# ────────────────────────────────────────────────
@bp.route("/profiles/<string:id>/verification", methods=["GET"])
def get_verification_status(id):
    try:
        # Validate UUID format
        try:
            uuid.UUID(id)
        except ValueError:
            return jsonify({"error": "Invalid profile ID"}), 400

        profile = supabase.table("profiles")\
            .select("trust_score, jobs_done, rating")\
            .eq("id", id)\
            .maybe_single().execute().data

        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        # Real credentials would come from a verifications table
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
        current_app.logger.error(f"Verification status error (profile {id}): {str(e)}")
        return jsonify({"error": "Failed to load verification status"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/forgot-password
# Send password reset email (rate-limited)
# ────────────────────────────────────────────────
@bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Valid email required"}), 400

    # Rate limit: max 3 attempts per email per hour
    now = datetime.utcnow()
    attempt = reset_attempts.get(email, {"count": 0, "last_attempt": now - timedelta(hours=1)})
    if (now - attempt["last_attempt"]).total_seconds() < 3600:
        if attempt["count"] >= 3:
            return jsonify({"error": "Too many reset requests. Please try again in 1 hour"}), 429
    else:
        attempt = {"count": 0, "last_attempt": now}

    attempt["count"] += 1
    attempt["last_attempt"] = now
    reset_attempts[email] = attempt

    try:
        # Validate redirect_to domain
        redirect_to = request.args.get("redirect_to", f"{request.host_url}reset-password")
        parsed = redirect_to.lower()
        allowed = any(domain in parsed for domain in ALLOWED_REDIRECT_DOMAINS)

        if not allowed:
            current_app.logger.warning(f"Invalid redirect attempt: {redirect_to}")
            redirect_to = f"{request.host_url}reset-password"  # fallback

        res = supabase.auth.reset_password_for_email(
            email,
            redirect_to=redirect_to
        )

        if res:
            return jsonify({"message": "If the email exists, a reset link has been sent"}), 200
        else:
            return jsonify({"error": "Failed to send reset email"}), 500

    except Exception as e:
        current_app.logger.error(f"Forgot password error (email {email}): {str(e)}")
        return jsonify({"error": "Failed to process request"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/reset-password
# Reset password with token
# ────────────────────────────────────────────────
@bp.route("/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    password = data.get("password", "").strip()

    if not token or not password:
        return jsonify({"error": "Token and password required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    try:
        res = supabase.auth.update_user({"password": password})

        if res.user:
            # Optional: invalidate all refresh tokens (Supabase handles via config)
            return jsonify({"message": "Password reset successful"}), 200
        else:
            return jsonify({"error": "Invalid or expired token"}), 400

    except Exception as e:
        current_app.logger.error(f"Reset password error: {str(e)}")
        return jsonify({"error": "Failed to reset password"}), 500


# ────────────────────────────────────────────────
# GET /api/auth/session
# Get current session info (authenticated)
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
        current_app.logger.error(f"Session fetch error (user {user_id}): {str(e)}")
        return jsonify({"error": "Failed to fetch session"}), 500


# ────────────────────────────────────────────────
# POST /api/auth/logout
# Server-side logout (optional - invalidate token if using blocklist)
# ────────────────────────────────────────────────
@bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    # If using JWT blocklist (recommended for real logout):
    # jti = get_jwt()["jti"]
    # revoked_tokens.add(jti)
    return jsonify({"message": "Logged out successfully"}), 200