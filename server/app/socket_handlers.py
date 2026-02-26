from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token, get_jwt_identity
from app.services.supabase_service import supabase
from datetime import datetime
import logging
from redis import Redis
import os
import time

logger = logging.getLogger(__name__)

# Redis client for rate limiting
redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))

# Rate limit settings - 8 messages per 60 seconds per user
RATE_LIMIT_COUNT = 8
RATE_LIMIT_WINDOW_SECONDS = 60

def is_rate_limited(user_id: str) -> bool:
    """Simple sliding window rate limit using Redis"""
    key = f"chat_rate_limit:{user_id}"
    now = time.time()
    
    # Remove old timestamps
    redis_client.zremrangebyscore(key, 0, now - RATE_LIMIT_WINDOW_SECONDS)
    
    # Count messages in window
    count = redis_client.zcard(key)
    
    if count >= RATE_LIMIT_COUNT:
        return True
    
    # Add current timestamp
    redis_client.zadd(key, {str(now): now})
    redis_client.expire(key, RATE_LIMIT_WINDOW_SECONDS + 10)
    
    return False

def init_socketio(socketio):

    @socketio.on("connect")
    def handle_connect():
        token = request.args.get("token")
        if not token:
            emit("error", {"message": "Authentication token required"})
            return False

        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
            join_room(f"user_{user_id}")
            emit("connected", {"message": "Real-time connected", "user_id": user_id})
            logger.info(f"User {user_id} connected via socket")
        except Exception as e:
            logger.error(f"Socket connect authentication failed: {str(e)}", exc_info=True)
            emit("error", {"message": "Authentication failed"})
            return False

    @socketio.on("disconnect")
    def handle_disconnect():
        logger.info("Socket client disconnected")

    @socketio.on("join_conversation")
    def on_join(data):
        token = request.args.get("token")
        if not token:
            emit("error", {"message": "Token required"})
            return

        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
        except Exception as e:
            logger.error(f"Join conversation - invalid token: {str(e)}")
            emit("error", {"message": "Invalid authentication"})
            return

        conversation_id = data.get("conversation_id")
        if not conversation_id:
            emit("error", {"message": "conversation_id required"})
            return

        room = f"conv_{conversation_id}"
        join_room(room)
        emit("status", {"message": f"Joined conversation {conversation_id}"}, room=request.sid)

        # Mark unread messages as read
        try:
            unread = supabase.table("messages")\
                .update({"read_at": datetime.utcnow().isoformat()})\
                .eq("receiver_id", user_id)\
                .eq("booking_id", conversation_id)\
                .is_("read_at", None)\
                .execute()

            if unread.data:
                emit("messages_read", {
                    "booking_id": conversation_id,
                    "count": len(unread.data)
                }, room=room)
                
        except Exception as e:
            logger.error(f"Failed to mark messages as read: {str(e)}", exc_info=True)
            # silent fail to client - don't break join

    @socketio.on("send_message")
    def handle_message(data):
        token = request.args.get("token")
        if not token:
            emit("error", {"message": "Authentication required"})
            return

        try:
            decoded = decode_token(token)
            sender_id = decoded["sub"]
        except Exception as e:
            logger.error(f"Send message - auth failed: {str(e)}")
            emit("error", {"message": "Authentication failed"})
            return

        receiver_id = data.get("receiver_id")
        content = data.get("content", "").strip()
        booking_id = data.get("booking_id")

        if not receiver_id or not content:
            emit("error", {"message": "receiver_id and content are required"})
            return

        # Rate limiting
        if is_rate_limited(sender_id):
            emit("error", {"message": "You are sending messages too quickly. Please wait a moment."})
            return

        message = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "booking_id": booking_id or None,
            "created_at": datetime.utcnow().isoformat(),
            "read_at": None
        }

        try:
            res = supabase.table("messages").insert(message).execute()
            if not res.data:
                emit("error", {"message": "Could not save message"})
                return

            saved = res.data[0]

            room = f"conv_{booking_id}" if booking_id else f"user_{receiver_id}"

            emit("new_message", {
                "id": saved["id"],
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "content": saved["content"],
                "booking_id": saved["booking_id"],
                "created_at": saved["created_at"],
                "read_at": None
            }, room=room)

            # Personal notification to receiver
            emit("notification", {
                "type": "message",
                "sender_id": sender_id,
                "content": "New message received",
                "booking_id": booking_id
            }, room=f"user_{receiver_id}")

        except Exception as e:
            logger.error(f"Failed to process/send message: {str(e)}", exc_info=True)
            emit("error", {"message": "Failed to send message. Please try again."})

    @socketio.on("booking_update")
    def handle_booking_update(data):
        token = request.args.get("token")
        if not token:
            return

        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
        except Exception:
            return

        booking_id = data.get("booking_id")
        new_status = data.get("status")

        if not booking_id or not new_status:
            return

        try:
            # Verify ownership (seller only)
            booking = supabase.table("bookings")\
                .select("seller_id")\
                .eq("id", booking_id)\
                .maybe_single().execute().data

            if not booking or booking["seller_id"] != user_id:
                emit("error", {"message": "Unauthorized action"})
                return

            emit("booking_updated", {
                "booking_id": booking_id,
                "status": new_status,
                "updated_by": user_id
            }, room=f"conv_{booking_id}")

        except Exception as e:
            logger.error(f"Booking update broadcast failed: {str(e)}", exc_info=True)