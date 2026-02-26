# server/app.py
from flask import Flask, jsonify
from flask_cors import CORS
from app import create_app, socketio

app = Flask(__name__)
CORS(app)

app, socketio = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        host="0.0.0.0",
        port=5000,
        allow_unsafe_werkzeug=True,
        log_output=True
    )