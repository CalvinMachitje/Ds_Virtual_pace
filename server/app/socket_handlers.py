# app/socket_handlers.py
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app.services.supabase_service import supabase
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
            logger.info(f"User {user_id} connected")
        except Exception as e:
            logger.error(f"Connect auth failed: {str(e)}")
            emit("error", {"message": "Authentication failed"})
            return False

    @socketio.on("disconnect")
    def handle_disconnect():
        logger.info("Client disconnected")

    @socketio.on("join_conversation")
    def on_join(data):
        token = request.args.get("token")
        if not token:
            emit("error", {"message": "Token required"})
            return

        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
        except:
            emit("error", {"message": "Invalid token"})
            return

        conversation_id = data.get("conversation_id")  # usually booking_id
        if not conversation_id:
            emit("error", {"message": "conversation_id required"})
            return

        room = f"conv_{conversation_id}"
        join_room(room)
        emit("status", {"message": f"Joined conversation {conversation_id}"}, room=request.sid)

        # Optional: mark unread messages as read when joining
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
            logger.error(f"Mark read failed: {str(e)}")

    @socketio.on("send_message")
    def handle_message(data):
        token = request.args.get("token")
        if not token:
            emit("error", {"message": "Token required"})
            return

        try:
            decoded = decode_token(token)
            sender_id = decoded["sub"]
        except:
            emit("error", {"message": "Authentication failed"})
            return

        receiver_id = data.get("receiver_id")
        content = data.get("content", "").strip()
        booking_id = data.get("booking_id")  # optional — for conversation context

        if not receiver_id or not content:
            emit("error", {"message": "receiver_id and content required"})
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
                emit("error", {"message": "Failed to save message"})
                return

            saved = res.data[0]

            # Send to conversation room (both parties)
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

            # Also notify receiver personally (for badge/unread count)
            emit("notification", {
                "type": "message",
                "sender_id": sender_id,
                "content": "New message received",
                "booking_id": booking_id
            }, room=f"user_{receiver_id}")

        except Exception as e:
            logger.error(f"Message save failed: {str(e)}")
            emit("error", {"message": "Failed to send message"})

    @socketio.on("booking_update")
    def handle_booking_update(data):
        token = request.args.get("token")
        if not token:
            return

        try:
            decoded = decode_token(token)
            user_id = decoded["sub"]
        except:
            return

        booking_id = data.get("booking_id")
        new_status = data.get("status")

        if not booking_id or not new_status:
            return

        try:
            # Optional: verify user is seller of this booking
            booking = supabase.table("bookings")\
                .select("seller_id")\
                .eq("id", booking_id)\
                .maybe_single().execute().data

            if not booking or booking["seller_id"] != user_id:
                emit("error", {"message": "Unauthorized"})
                return

            # Broadcast update to conversation room
            emit("booking_updated", {
                "booking_id": booking_id,
                "status": new_status,
                "updated_by": user_id
            }, room=f"conv_{booking_id}")

        except Exception as e:
            logger.error(f"Booking update failed: {str(e)}")