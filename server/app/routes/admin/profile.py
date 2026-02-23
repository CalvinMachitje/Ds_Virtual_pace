# server/app/routes/admin/profile.py
from flask import Blueprint, jsonify, request
from app.services.supabase_service import supabase
from functools import wraps
import os

bp = Blueprint('admin_profile', __name__, url_prefix='/admin/profile')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder: Later replace with real JWT + role check
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized - Admin only"}), 401
        return f(*args, **kwargs)
    return decorated

@bp.route('/<user_id>', methods=['GET'])
@admin_required
def get_admin_profile(user_id):
    try:
        profile = supabase.client.table('admins').select('*').eq('id', user_id).single().execute()
        if not profile.data:
            return jsonify({"error": "Admin profile not found"}), 404
        return jsonify(profile.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/<user_id>', methods=['PATCH'])
@admin_required
def update_admin_profile(user_id):
    try:
        data = request.get_json()
        update_payload = {}

        if 'full_name' in data:
            update_payload['full_name'] = data['full_name'].strip()

        if 'permissions' in data:
            update_payload['permissions'] = data['permissions']

        if 'new_password' in data:
            if data['new_password'] != data.get('confirm_password'):
                return jsonify({"error": "Passwords do not match"}), 400
            if len(data['new_password']) < 6:
                return jsonify({"error": "Password must be at least 6 characters"}), 400

            # Update password via Supabase Auth
            auth_res = supabase.client.auth.update_user({"password": data['new_password']})
            if hasattr(auth_res, 'error') and auth_res.error:
                return jsonify({"error": auth_res.error.message}), 400

        if update_payload:
            update_payload['updated_at'] = 'now()'
            updated = supabase.client.table('admins').update(update_payload).eq('id', user_id).execute()
            if not updated.data:
                return jsonify({"error": "Update failed"}), 400
            return jsonify(updated.data[0]), 200

        return jsonify({"message": "No changes provided"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500