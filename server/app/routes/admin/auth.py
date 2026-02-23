# server/app/routes/admin/auth.py
from flask import Blueprint, request, jsonify
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

bp = Blueprint('admin_auth', __name__, url_prefix='/admin/auth')

# Use service_role key for admin login verification
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

@bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        # Sign in with Supabase Auth
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if hasattr(response, 'error') and response.error:
            return jsonify({"error": response.error.message}), 401

        user = response.user
        session = response.session

        # Check if user is in admins table
        admin_check = supabase.table('admins').select('*').eq('id', user.id).single().execute()

        if not admin_check.data:
            # Optional: sign out the user if not admin
            supabase.auth.sign_out()
            return jsonify({"error": "Not an admin account"}), 403

        return jsonify({
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "admin_level": admin_check.data.get('admin_level'),
                "permissions": admin_check.data.get('permissions', {})
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500