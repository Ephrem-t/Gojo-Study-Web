"""
Startup script for Gojo HR Backend.
Validates environment and starts the Flask application.
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# Validate environment
try:
    from check_env import check_environment
    if not check_environment():
        sys.exit(1)
except ImportError:
    print("⚠️  check_env.py not found. Skipping validation.")

print("\n🚀 Starting Gojo HR Backend...\n")

# Import and run the Flask app
try:
    from hr_app import app
    
    # Get configuration from environment
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 'yes')
    
    print(f"🌐 Server running at: http://{host}:{port}")
    print(f"🔧 Debug mode: {'ON' if debug else 'OFF'}")
    print(f"📝 Environment: {os.getenv('FLASK_ENV', 'development')}")
    print()
    
    # Start the application
    app.run(
        host=host,
        port=port,
        debug=debug
    )
    
except Exception as e:
    print(f"\n❌ Failed to start application:")
    print(f"   {type(e).__name__}: {e}")
    sys.exit(1)
