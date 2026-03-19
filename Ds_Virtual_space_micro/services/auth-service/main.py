# services/auth-service/main.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Make sure you are importing the function, not the module
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    debug = app.config.get("DEBUG", False)

    print("=" * 60)
    print(f"Starting Auth Service on http://0.0.0.0:{port}")
    print("Press Ctrl+C to stop")
    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug,
        use_reloader=debug
    )