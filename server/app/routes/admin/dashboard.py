# server/app/routes/admin/dashboard.py
from flask import Blueprint, jsonify
from app.services.supabase_service import supabase
from functools import wraps

bp = Blueprint('admin_dashboard', __name__, url_prefix='/admin/dashboard')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder: Add JWT check later
        return f(*args, **kwargs)
    return decorated

@bp.route('/stats', methods=['GET'])
@admin_required
def get_dashboard_stats():
    try:
        # Total users
        users_count = supabase.client.table('profiles').select('id', count='exact').execute().count

        # Sellers & Buyers
        sellers = supabase.client.table('profiles').select('id').eq('role', 'seller').execute().data
        buyers = supabase.client.table('profiles').select('id').eq('role', 'buyer').execute().data

        # Bookings
        bookings_count = supabase.client.table('bookings').select('id', count='exact').execute().count

        # Revenue (sum of booking prices)
        revenue_result = supabase.client.table('bookings').select('price').execute().data
        total_revenue = sum(b['price'] for b in revenue_result if b['price'])

        stats = {
            "total_users": users_count or 0,
            "total_sellers": len(sellers),
            "total_buyers": len(buyers),
            "total_bookings": bookings_count or 0,
            "total_revenue": total_revenue
        }

        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500