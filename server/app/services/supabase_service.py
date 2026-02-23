# server/app/services/supabase_service.py
"""
Central Supabase client service for the Flask backend.
Uses service_role key for full admin access (server-only!).
"""

import os
from typing import Any, Dict, List, Optional, Union
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseService:
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not key:
            raise ValueError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file"
            )

        self.client: Client = create_client(url, key)
        # Optional: set auth for service role (helps with RLS bypass)
        self.client.postgrest.auth(key)

    # ────────────────────────────────────────────────
    # Generic CRUD helpers
    # ────────────────────────────────────────────────

    def get_all(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        order_by: str = "created_at",
        desc: bool = True,
        limit: Optional[int] = None,
        select: str = "*",
    ) -> List[Dict]:
        """Fetch multiple rows with optional filtering/sorting/limit."""
        query = self.client.table(table).select(select)

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)

        if order_by:
            query = query.order(order_by, desc=desc)

        if limit:
            query = query.limit(limit)

        response = query.execute()
        return response.data or []

    def get_by_id(self, table: str, id: str, select: str = "*") -> Optional[Dict]:
        """Fetch a single row by ID."""
        response = (
            self.client.table(table).select(select).eq("id", id).maybe_single().execute()
        )
        return response.data

    def insert(self, table: str, data: Dict) -> Dict:
        """Insert a new row."""
        response = self.client.table(table).insert(data).execute()
        if not response.data:
            raise Exception(f"Insert failed on {table}: {response}")
        return response.data[0]

    def update(self, table: str, id: str, data: Dict) -> Dict:
        """Update a row by ID."""
        response = self.client.table(table).update(data).eq("id", id).execute()
        if not response.data:
            raise Exception(f"Update failed on {table} {id}")
        return response.data[0]

    def delete(self, table: str, id: str) -> bool:
        """Delete a row by ID."""
        response = self.client.table(table).delete().eq("id", id).execute()
        return bool(response.data)

    # ────────────────────────────────────────────────
    # Admin-specific convenience methods
    # ────────────────────────────────────────────────

    def get_users(self, role: Optional[str] = None) -> List[Dict]:
        """Get all users, optionally filtered by role."""
        query = self.client.table("profiles").select("*")
        if role:
            query = query.eq("role", role)
        return query.order("created_at", desc=True).execute().data or []

    def verify_seller(self, seller_id: str, verified: bool = True) -> Dict:
        """Mark a seller as verified (or unverified)."""
        return self.update("profiles", seller_id, {"is_verified": verified})

    def get_pending_verifications(self) -> List[Dict]:
        """Get pending seller verifications with profile info."""
        return (
            self.client.table("verifications")
            .select(
                """
                id, seller_id, type, status, submitted_at, evidence_url,
                profiles!seller_id (full_name, email)
                """
            )
            .eq("status", "pending")
            .order("submitted_at", desc=True)
            .execute()
        ).data or []

    def get_analytics_summary(self) -> Dict:
        """Basic platform stats for admin dashboard."""
        # Users count by role
        profiles = self.client.table("profiles").select("role").execute().data or []
        total_users = len(profiles)
        total_sellers = len([p for p in profiles if p["role"] == "seller"])
        total_buyers = len([p for p in profiles if p["role"] == "buyer"])

        # Bookings & revenue
        bookings = self.client.table("bookings").select("price").execute().data or []
        total_bookings = len(bookings)
        total_revenue = sum(b["price"] or 0 for b in bookings)

        role_distribution = [
            {"role": "Buyers", "count": total_buyers},
            {"role": "Sellers", "count": total_sellers},
            {"role": "Admins", "count": total_users - total_sellers - total_buyers},
        ]

        return {
            "total_users": total_users,
            "total_sellers": total_sellers,
            "total_buyers": total_buyers,
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "role_distribution": role_distribution,
        }

# Global singleton instance – import and use this in routes
supabase = SupabaseService()