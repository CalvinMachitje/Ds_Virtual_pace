from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Very important! Allows React (different port) to talk to Flask

@app.route('/api/hello')
def hello():
    return jsonify({"message": "Hello from Flask backend! 🚀"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)