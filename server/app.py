# server/app.py
from flask import Flask
from flask_cors import CORS
from app import create_app, socketio  # ← socketio is now global from extensions

# Create the app instance
app = create_app()

CORS(app)

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5000,
        allow_unsafe_werkzeug=True,
        log_output=True
    )