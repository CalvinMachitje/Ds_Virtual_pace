# app/services/supabase_service.py
"""
Central Supabase client for backend (uses service_role key → full access).
Never use this file in frontend code.
"""

import os
from typing import Any, Dict, List, Optional, Callable
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
import time
from app.extensions import redis_client

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
        http_client = httpx.Client(
            timeout=httpx.Timeout(90.0, connect=45.0, read=90.0, pool=90.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
            transport=httpx.HTTPTransport(retries=10),
            http2=False  # MUST be False - fixes most disconnects
        )

        self.client: Client = create_client(url, key)
        self.client.options.http = http_client

        self.auth = self.client.auth
        self.table = self.client.table
        self.storage = self.client.storage  # Explicitly expose storage

        logger.info("Supabase client initialized (stable config applied)")

    # ──────────────────────────────────────────────
    # Safe execute with retry (handles disconnects/timeouts)
    # ──────────────────────────────────────────────
    def safe_execute(self, query_builder: Callable, retries: int = 5, backoff: int = 2) -> Any:
        """
        Execute Supabase query with retries on transient errors.
        
        Args:
            query_builder: A callable that returns a query object (e.g. lambda: self.table("...").select(...))
            retries: Max retry attempts
            backoff: Base seconds for exponential backoff
        
        Returns:
            Query response object
        
        Raises:
            Last exception after retries
        """
        last_exc = None
        for attempt in range(retries):
            try:
                query = query_builder()
                result = query.execute()
                return result
            except Exception as e:
                last_exc = e
                error_str = str(e).lower()
                if any(x in error_str for x in ["disconnected", "timeout", "remote", "eof", "connection"]):
                    wait = backoff ** attempt
                    logger.warning(f"Supabase retry {attempt+1}/{retries} after {wait}s: {error_str}")
                    time.sleep(wait)
                    continue
                # Non-transient error → fail fast
                raise

        logger.error(f"Supabase query failed after {retries} retries: {str(last_exc)}", exc_info=True)
        raise last_exc

    # ──────────────────────────────────────────────
    # Connection health check
    # ──────────────────────────────────────────────
    def check_connection(self) -> Dict[str, Any]:
        """Perform health check on Supabase and Redis."""
        result = {"supabase": "unknown", "redis": "unknown"}

        # Supabase check
        try:
            self.safe_execute(
                lambda: self.client.table("profiles").select("count(*)", count="exact").limit(1)
            )
            result["supabase"] = "ok"
        except Exception as e:
            logger.error(f"Supabase connection check failed: {str(e)}")
            result["supabase"] = f"error: {str(e)}"

        # Redis check
        try:
            if redis_client.ping():
                result["redis"] = "ok"
            else:
                result["redis"] = "not responding"
        except Exception as redis_err:
            logger.warning(f"Redis ping failed in health check: {str(redis_err)}")
            result["redis"] = f"error: {str(redis_err)}"

        status = "ok" if result["supabase"] == "ok" and result["redis"] == "ok" else "partial"
        return {"status": status, **result}

    # ──────────────────────────────────────────────
    # Generic CRUD methods (using safe_execute)
    # ──────────────────────────────────────────────

    def get_all(self, table: str, filters: Optional[Dict[str, Any]] = None,
                order_by: str = "created_at", desc: bool = True, limit: Optional[int] = None,
                select: str = "*") -> List[Dict]:
        """Fetch all records with optional filters."""
        try:
            query_builder = lambda: self.client.table(table).select(select)
            if filters:
                for k, v in filters.items():
                    if v is not None:
                        query_builder = lambda q=query_builder(), k=k, v=v: q.eq(k, v)
            if order_by:
                query_builder = lambda q=query_builder(), o=order_by, d=desc: q.order(o, desc=d)
            if limit:
                query_builder = lambda q=query_builder(), l=limit: q.limit(l)

            result = self.safe_execute(query_builder)
            return result.data or []
        except Exception as e:
            logger.error(f"get_all failed on {table}: {e}", exc_info=True)
            return []

    def get_by_id(self, table: str, id: str, select: str = "*") -> Optional[Dict]:
        """Fetch single record by ID."""
        try:
            result = self.safe_execute(
                lambda: self.client.table(table).select(select).eq("id", id).maybe_single()
            )
            return result.data
        except Exception as e:
            logger.error(f"get_by_id failed on {table}/{id}: {e}")
            return None

    def insert(self, table: str, data: Dict) -> Optional[Dict]:
        """Insert new record."""
        try:
            result = self.safe_execute(lambda: self.client.table(table).insert(data))
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"insert failed on {table}: {e}", exc_info=True)
            return None

    def update(self, table: str, id: str, data: Dict) -> Optional[Dict]:
        """Update record by ID."""
        try:
            result = self.safe_execute(
                lambda: self.client.table(table).update(data).eq("id", id)
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"update failed on {table}/{id}: {e}")
            return None

    def delete(self, table: str, id: str) -> bool:
        """Delete record by ID."""
        try:
            result = self.safe_execute(
                lambda: self.client.table(table).delete().eq("id", id)
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"delete failed on {table}/{id}: {e}")
            return False

    # ──────────────────────────────────────────────
    # Convenience methods
    # ──────────────────────────────────────────────

    def get_profile(self, user_id: str) -> Optional[Dict]:
        return self.get_by_id("profiles", user_id)

    def get_users(self, role: Optional[str] = None) -> List[Dict]:
        try:
            query_builder = lambda: self.client.table("profiles").select("*")
            if role:
                query_builder = lambda q=query_builder(), r=role: q.eq("role", r)

            result = self.safe_execute(lambda q=query_builder(): q.order("created_at", desc=True))
            return result.data or []
        except Exception as e:
            logger.error(f"get_users failed: {e}")
            return []

    def verify_seller(self, seller_id: str, verified: bool = True) -> Optional[Dict]:
        return self.update("profiles", seller_id, {"is_verified": verified})

    def get_pending_verifications(self) -> List[Dict]:
        try:
            query_builder = lambda: (
                self.client.table("verifications")
                .select("""
                    id, seller_id, type, status, submitted_at, evidence_urls,
                    rejection_reason, profiles!seller_id(full_name, email)
                """)
                .eq("status", "pending")
                .order("submitted_at", desc=True)
            )
            result = self.safe_execute(query_builder)
            return result.data or []
        except Exception as e:
            logger.error(f"get_pending_verifications failed: {e}")
            return []

    def get_analytics_summary(self) -> Dict:
        try:
            profiles_result = self.safe_execute(
                lambda: self.client.table("profiles").select("role")
            )
            profiles = profiles_result.data or []

            bookings_result = self.safe_execute(
                lambda: self.client.table("bookings").select("price")
            )
            bookings = bookings_result.data or []

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


# Singleton instance (export this)
supabase = SupabaseService()