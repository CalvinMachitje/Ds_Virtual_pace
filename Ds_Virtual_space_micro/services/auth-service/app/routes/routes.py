# app/routes/routes.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from jose import JWTError, jwt

from app.core.config import settings
from app.dependencies.auth import get_current_user, oauth2_scheme
from app.dependencies.rate_limiter import limiter
from app.services.supabase_service import supabase
from app.utils.audit import log_action
from app.utils.event_bus import publish_event
from app.utils.utils import (
    generate_tokens,
    is_strong_password,
    blacklist_jwt,
    safe_redis_call
)
from .twofa import verify_2fa_code  # 2FA helper function

router = APIRouter(tags=["auth"])


# ────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    otp: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResetPasswordConfirmRequest(BaseModel):
    token: str
    password: str


# ────────────────────────────────────────────────
# GET /ping
# ────────────────────────────────────────────────
@router.get("/ping")
async def ping():
    return {"pong": True}


# ────────────────────────────────────────────────
# POST /signup
# ────────────────────────────────────────────────
@router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_SIGNUP)
async def signup(data: SignupRequest, request: Request):
    email = data.email.strip().lower()
    ip = request.client.host or "unknown"

    if data.role not in ["buyer", "seller"]:
        raise HTTPException(400, detail=f"Role must be one of ['buyer', 'seller']")

    valid, msg = is_strong_password(data.password)
    if not valid:
        raise HTTPException(400, detail=msg)

    lock_key = f"signup_lock:{email}:{ip}"

    if safe_redis_call("exists", lock_key):
        ttl = safe_redis_call("ttl", lock_key, default=0)
        raise HTTPException(
            429,
            detail=f"Too many signup attempts. Try again in {ttl // 60 + 1} min"
        )

    acquired = safe_redis_call("set", lock_key, "1", nx=True, ex=10)
    if not acquired:
        ttl = safe_redis_call("ttl", lock_key, default=0)
        raise HTTPException(
            429,
            detail=f"Concurrent signup attempt — try again in {ttl // 60 + 1} min"
        )

    try:
        # Check if email exists
        existing = supabase.table("profiles").select("id").eq("email", email).maybe_single().execute()
        if existing.data:
            raise HTTPException(409, detail="Email already registered")

        # Sign up via Supabase Auth
        sign_up = supabase.auth.sign_up({
            "email": email,
            "password": data.password,
            "options": {
                "data": {
                    "full_name": data.full_name,
                    "phone": data.phone or "",
                    "role": data.role
                }
            }
        })

        if not sign_up.user:
            raise HTTPException(500, detail="User creation failed")

        # Create profile record
        supabase.table("profiles").insert({
            "id": sign_up.user.id,
            "full_name": data.full_name,
            "email": email,
            "phone": data.phone,
            "role": data.role,
            "created_at": "now()",
            "updated_at": "now()"
        }).execute()

        # Audit & event
        log_action(sign_up.user.id, "signup", {
            "email": email,
            "role": data.role,
            "ip": ip
        })

        publish_event("auth.events", {
            "event": "user_registered",
            "user_id": sign_up.user.id,
            "email": email,
            "full_name": data.full_name,
            "role": data.role
        })

        # If email confirmation is required
        if not sign_up.session:
            return {
                "success": True,
                "message": "Check your email to confirm account",
                "email_confirmation_sent": True
            }

        # Auto-login (no confirmation required)
        access_token, refresh_token = generate_tokens(str(sign_up.user.id))

        return {
            "success": True,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": sign_up.user.id,
                "email": email,
                "full_name": data.full_name,
                "role": data.role,
                "phone": data.phone
            }
        }

    finally:
        safe_redis_call("delete", lock_key)


# ────────────────────────────────────────────────
# POST /login
# ────────────────────────────────────────────────
@router.post("/login")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(data: LoginRequest, request: Request):
    email = data.email.strip().lower()
    password = data.password
    otp = data.otp
    ip = request.client.host or "unknown"

    fail_key = f"login_fail:{email}:{ip}"
    lock_key = f"login_lock:{email}:{ip}"

    # Check lock
    if safe_redis_call("exists", lock_key):
        ttl = safe_redis_call("ttl", lock_key, default=0)
        raise HTTPException(
            429,
            detail=f"Too many failed attempts. Try again in {ttl // 60 + 1} min"
        )

    # Acquire lock
    acquired = safe_redis_call("set", lock_key, "1", nx=True, ex=10)
    if not acquired:
        ttl = safe_redis_call("ttl", lock_key, default=0)
        raise HTTPException(
            429,
            detail=f"Concurrent login attempt — try again in {ttl // 60 + 1} min"
        )

    try:
        # Authenticate with Supabase
        auth_resp = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = auth_resp.user

        if not user:
            fails = safe_redis_call("incr", fail_key) or 1
            safe_redis_call("expire", fail_key, 1800)
            raise HTTPException(401, detail="Invalid email or password")

        # Fetch profile
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
        profile = profile_res.data or {}

        if profile.get("banned"):
            raise HTTPException(403, detail="Account banned")

        if not user.email_confirmed_at:
            raise HTTPException(
                403,
                detail="Confirm email first",
                headers={"X-Needs-Confirmation": "true"}
            )

        # Handle 2FA
        if profile.get("two_factor_enabled"):
            if not otp:
                publish_event("auth.events", {"event": "2fa_required", "user_id": user.id, "email": email})
                return {"success": True, "requires_2fa": True, "message": "2FA code required"}

            if not verify_2fa_code(user.id, otp):
                raise HTTPException(401, detail="Invalid 2FA code")

            publish_event("auth.events", {"event": "2fa_verified", "user_id": user.id, "email": email})

        # Success
        safe_redis_call("delete", fail_key)
        safe_redis_call("delete", lock_key)

        access_token, refresh_token = generate_tokens(str(user.id))

        log_action(user.id, "user_login", {
            "email": email,
            "role": profile.get("role", "unknown"),
            "ip": ip
        })

        publish_event("auth.events", {
            "event": "user_logged_in",
            "user_id": user.id,
            "email": email,
            "role": profile.get("role")
        })

        return {
            "success": True,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                **profile,
                "email": user.email,
                "email_confirmed": bool(user.email_confirmed_at)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        safe_redis_call("incr", fail_key)
        safe_redis_call("expire", fail_key, 1800)
        raise HTTPException(401, detail="Login failed. Try again.")
    finally:
        safe_redis_call("delete", lock_key)


# ────────────────────────────────────────────────
# POST /refresh
# ────────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(payload: RefreshRequest):
    try:
        decoded = jwt.decode(
            payload.refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        user_id = decoded.get("sub")
        if not user_id:
            raise ValueError("Invalid refresh token")

        new_access_token, _ = generate_tokens(user_id)

        publish_event("auth.events", {
            "event": "access_token_refreshed",
            "user_id": user_id
        })

        return {"success": True, "access_token": new_access_token}

    except JWTError:
        raise HTTPException(401, detail="Invalid or expired refresh token")
    except Exception as e:
        raise HTTPException(401, detail=str(e))


# ────────────────────────────────────────────────
# GET /me (protected)
# ────────────────────────────────────────────────
@router.get("/me")
async def get_me(current_user: str = Depends(get_current_user)):
    profile = supabase.table("profiles").select("*").eq("id", current_user).maybe_single().execute().data

    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return {"success": True, "user": profile}


# ────────────────────────────────────────────────
# POST /logout (blacklist current token)
# ────────────────────────────────────────────────
@router.post("/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    blacklist_jwt(token)
    return {"success": True, "message": "Logged out successfully"}


# ────────────────────────────────────────────────
# POST /verify-email
# ────────────────────────────────────────────────
@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest):
    try:
        # Supabase OTP verification (adjust type if needed: signup / magiclink / etc.)
        verified = supabase.auth.verify_otp({
            "token_hash": payload.token,
            "type": "signup"
        })

        if not verified.user:
            raise HTTPException(400, detail="Invalid or expired token")

        user_id = verified.user.id

        supabase.table("profiles").update({
            "email_verified": True,
            "updated_at": "now()"
        }).eq("id", user_id).execute()

        access_token, refresh_token = generate_tokens(user_id)

        log_action(user_id, "email_verified")
        publish_event("auth.events", {"event": "email_verified", "user_id": user_id})

        return {
            "success": True,
            "message": "Email verified successfully",
            "access_token": access_token,
            "refresh_token": refresh_token
        }

    except Exception as e:
        raise HTTPException(400, detail=f"Verification failed: {str(e)}")


# ────────────────────────────────────────────────
# POST /reset-password/confirm
# ────────────────────────────────────────────────
@router.post("/reset-password/confirm")
async def reset_password_confirm(payload: ResetPasswordConfirmRequest):
    try:
        # This assumes the token was already used to enter recovery mode
        # In real Supabase flows, you usually call update_user after recovery
        updated = supabase.auth.update_user({"password": payload.password})

        if not updated.user:
            raise HTTPException(400, detail="Invalid or expired reset token")

        log_action(updated.user.id, "password_reset_confirmed")
        publish_event("auth.events", {
            "event": "password_reset",
            "user_id": updated.user.id
        })

        return {"success": True, "message": "Password reset successful"}

    except Exception as e:
        raise HTTPException(400, detail=f"Password reset failed: {str(e)}")