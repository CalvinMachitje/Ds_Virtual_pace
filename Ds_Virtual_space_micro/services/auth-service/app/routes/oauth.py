# app/routes/oauth.py
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.supabase_service import supabase
from app.utils.audit import log_action
from app.utils.event_bus import publish_event
from utils.utils import generate_tokens 

router = APIRouter(prefix="/oauth", tags=["oauth"])


class OAuthStart(BaseModel):
    redirect_to: Optional[str] = None


@router.post("/{provider}")
async def start_oauth(provider: str, data: OAuthStart, request: Request):
    if provider not in ["google", "facebook"]:
        raise HTTPException(400, detail="Unsupported provider")

    redirect_to = data.redirect_to or f"{request.url.scheme}://{request.url.netloc}/api/auth/oauth/callback"

    try:
        result = supabase.auth.sign_in_with_oauth({
            "provider": provider,
            "options": {
                "redirect_to": redirect_to,
                "scopes": "email profile" if provider == "google" else "email public_profile",
                "query_params": {"access_type": "offline", "prompt": "consent"} if provider == "google" else {}
            }
        })

        url = getattr(result, "url", None) or result.get("url")
        if not url:
            raise ValueError("No OAuth URL returned")

        publish_event("auth.events", {
            "event": "oauth_started",
            "provider": provider,
            "redirect_to": redirect_to
        })

        return {"success": True, "oauth_url": url, "provider": provider}

    except Exception as e:
        raise HTTPException(500, detail=f"Failed to start {provider} OAuth: {str(e)}")


@router.post("/callback")
async def oauth_callback(code: str, provider: str):
    if not code or not provider:
        raise HTTPException(400, detail="Code and provider required")

    try:
        session = supabase.auth.exchange_code_for_session({"auth_code": code})
        user = session.user

        if not user:
            raise HTTPException(401, detail="OAuth failed")

        profile = supabase.table("profiles").select("*").eq("id", user.id).maybe_single().execute().data

        if not profile:
            full_name = user.user_metadata.get("full_name") or user.user_metadata.get("name") or user.email.split("@")[0].title()
            profile = {
                "id": user.id,
                "email": user.email,
                "full_name": full_name,
                "avatar_url": user.user_metadata.get("avatar_url"),
                "role": "buyer",
            }
            supabase.table("profiles").insert(profile).execute()
            publish_event("auth.events", {"event": "oauth_user_registered", "user_id": user.id})

        access, refresh = generate_tokens(str(user.id))

        publish_event("auth.events", {"event": "oauth_login_success", "user_id": user.id, "provider": provider})
        log_action(user.id, "oauth_login", {"provider": provider})

        return {
            "success": True,
            "access_token": access,
            "refresh_token": refresh,
            "user": profile
        }

    except Exception as e:
        raise HTTPException(500, detail=f"OAuth callback failed: {str(e)}")