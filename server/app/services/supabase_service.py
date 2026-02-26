# app/services/supabase_service.py
"""
Central Supabase client for backend (uses service_role key → full access).
Never use this file in frontend code.
"""

import os
from typing import Any, Dict, List, Optional
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()  # Load .env

logger = logging.getLogger(__name__)


class SupabaseService:
    def __init__(self):
        url = os.getenv("VITE_SUPABASE_URL")
        key = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

        if not url:
            raise ValueError("VITE_SUPABASE_URL is missing")
        if not key:
            raise ValueError("VITE_SUPABASE_SERVICE_ROLE_KEY is missing")

        logger.info(f"Initializing Supabase client with URL: {url}")

        # Stable HTTP client: timeouts, retries, force IPv4
        # Inside SupabaseService.__init__()
        http_client = httpx.Client(
            timeout=httpx.Timeout(90.0, connect=45.0, read=90.0, pool=90.0),  # longer timeouts
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
            transport=httpx.HTTPTransport(retries=10),  # retry 10 times
            http2=False  # MUST be False - fixes 90% of disconnects
        )

        self.client = create_client(url, key)
        self.client.options.http = http_client

        self.auth = self.client.auth
        self.table = self.client.table

        logger.info("Supabase client initialized (stable config applied)")

    # ──────────────────────────────────────────────
    # Generic CRUD
    # ──────────────────────────────────────────────

    def get_all(self, table: str, filters: Optional[Dict[str, Any]] = None,
                order_by: str = "created_at", desc: bool = True, limit: Optional[int] = None,
                select: str = "*") -> List[Dict]:
        try:
            query = self.client.table(table).select(select)
            if filters:
                for k, v in filters.items():
                    if v is not None:
                        query = query.eq(k, v)
            if order_by:
                query = query.order(order_by, desc=desc)
            if limit:
                query = query.limit(limit)
            return query.execute().data or []
        except Exception as e:
            logger.error(f"get_all failed on {table}: {e}", exc_info=True)
            return []

    def get_by_id(self, table: str, id: str, select: str = "*") -> Optional[Dict]:
        try:
            res = self.client.table(table).select(select).eq("id", id).maybe_single().execute()
            return res.data
        except Exception as e:
            logger.error(f"get_by_id failed on {table}/{id}: {e}")
            return None

    def insert(self, table: str, data: Dict) -> Optional[Dict]:
        try:
            res = self.client.table(table).insert(data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"insert failed on {table}: {e}", exc_info=True)
            return None

    def update(self, table: str, id: str, data: Dict) -> Optional[Dict]:
        try:
            res = self.client.table(table).update(data).eq("id", id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"update failed on {table}/{id}: {e}")
            return None

    def delete(self, table: str, id: str) -> bool:
        try:
            res = self.client.table(table).delete().eq("id", id).execute()
            return bool(res.data)
        except Exception as e:
            logger.error(f"delete failed on {table}/{id}: {e}")
            return False

    # ──────────────────────────────────────────────
    # Convenience
    # ──────────────────────────────────────────────

    def get_profile(self, user_id: str) -> Optional[Dict]:
        return self.get_by_id("profiles", user_id)

    def get_users(self, role: Optional[str] = None) -> List[Dict]:
        try:
            query = self.client.table("profiles").select("*")
            if role:
                query = query.eq("role", role)
            return query.order("created_at", desc=True).execute().data or []
        except Exception as e:
            logger.error(f"get_users failed: {e}")
            return []

    def verify_seller(self, seller_id: str, verified: bool = True) -> Optional[Dict]:
        return self.update("profiles", seller_id, {"is_verified": verified})

    def get_pending_verifications(self) -> List[Dict]:
        try:
            return self.client.table("verifications")\
                .select("""
                    id, seller_id, type, status, submitted_at, evidence_urls,
                    rejection_reason, profiles!seller_id(full_name, email)
                """)\
                .eq("status", "pending")\
                .order("submitted_at", desc=True)\
                .execute().data or []
        except Exception as e:
            logger.error(f"get_pending_verifications failed: {e}")
            return []

    def get_analytics_summary(self) -> Dict:
        try:
            profiles = self.client.table("profiles").select("role").execute().data or []
            bookings = self.client.table("bookings").select("price").execute().data or []

            return {
                "total_users": len(profiles),
                "total_sellers": sum(1 for p in profiles if p.get("role") == "seller"),
                "total_buyers": sum(1 for p in profiles if p.get("role") == "buyer"),
                "total_bookings": len(bookings),
                "total_revenue": sum(float(b.get("price") or 0) for b in bookings)
            }
        except Exception as e:
            logger.error(f"get_analytics_summary failed: {e}", exc_info=True)
            return {"error": "Could not load analytics"}


# Singleton instance
supabase = SupabaseService()