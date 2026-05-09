"""
Environment validation script for Gojo HR Backend.
Run this before starting the application to ensure all required environment variables are set.
"""
import os
import sys
from pathlib import Path

# Try to load .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    print(f"✅ Loaded environment from: {env_path}")
except ImportError:
    print("⚠️  python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Define required and optional variables
REQUIRED_VARS = {
    'SCHOOL_CODE': 'Default school code identifier',
}

RECOMMENDED_VARS = {
    'SECRET_KEY': 'Flask secret key for sessions',
    'ALLOWED_ORIGINS': 'CORS allowed origins (comma-separated)',
    'FLASK_ENV': 'Environment (development/production)',
}

OPTIONAL_VARS = {
    'FLASK_HOST': 'Server host address',
    'FLASK_PORT': 'Server port number',
    'FLASK_DEBUG': 'Enable debug mode',
    'PLATFORM_ROOT': 'Firebase platform root node',
    'EMPLOYEE_SUMMARY_CACHE_TTL_SECONDS': 'Cache TTL in seconds',
    'MAX_CONTENT_LENGTH': 'Maximum upload size in bytes',
    'LOG_LEVEL': 'Logging level',
    'RATE_LIMIT_ENABLED': 'Enable rate limiting',
    'RATE_LIMIT_PER_MINUTE': 'Rate limit per minute',
}

def check_environment():
    """Validate environment variables."""
    errors = []
    warnings = []
    info = []
    
    print("\n" + "="*70)
    print("🔍 Gojo HR Backend - Environment Validation")
    print("="*70 + "\n")
    
    # Check required variables
    print("📋 Required Variables:")
    for var, desc in REQUIRED_VARS.items():
        value = os.getenv(var)
        if not value:
            errors.append(f"❌ {var}: Missing - {desc}")
            print(f"  ❌ {var}: NOT SET")
        else:
            print(f"  ✅ {var}: {value}")
    
    print()
    
    # Check recommended variables
    print("⚠️  Recommended Variables:")
    for var, desc in RECOMMENDED_VARS.items():
        value = os.getenv(var)
        if not value:
            warnings.append(f"⚠️  {var}: Not set - {desc}")
            print(f"  ⚠️  {var}: NOT SET (will use default)")
        else:
            # Mask secret values
            display_value = value if var != 'SECRET_KEY' else f"{value[:8]}...{value[-4:]}"
            print(f"  ✅ {var}: {display_value}")
    
    print()
    
    # Check optional variables
    print("ℹ️  Optional Variables:")
    for var, desc in OPTIONAL_VARS.items():
        value = os.getenv(var)
        if value:
            print(f"  ✅ {var}: {value}")
        else:
            info.append(f"ℹ️  {var}: Using default - {desc}")
    
    print()
    
    # Validate specific configurations
    print("🔧 Configuration Validation:")
    
    # Check FLASK_ENV
    flask_env = os.getenv('FLASK_ENV', 'development')
    if flask_env == 'production':
        print(f"  ✅ Environment: PRODUCTION mode")
        
        # Additional production checks
        secret_key = os.getenv('SECRET_KEY', '')
        if not secret_key or secret_key == 'dev-secret-key-change-me-in-production':
            errors.append("❌ SECRET_KEY: Must be changed in production!")
            print(f"  ❌ SECRET_KEY: Using development key in production!")
        
        allowed_origins = os.getenv('ALLOWED_ORIGINS', '*')
        if allowed_origins == '*':
            warnings.append("⚠️  ALLOWED_ORIGINS: Using '*' in production is not recommended")
            print(f"  ⚠️  CORS: Allowing all origins (security risk)")
        else:
            origins = [o.strip() for o in allowed_origins.split(',')]
            print(f"  ✅ CORS: Restricted to {len(origins)} origin(s)")
    else:
        print(f"  ℹ️  Environment: DEVELOPMENT mode")
    
    # Check CORS configuration
    allowed_origins = os.getenv('ALLOWED_ORIGINS', '*')
    if allowed_origins != '*':
        origins = [o.strip() for o in allowed_origins.split(',') if o.strip()]
        print(f"  ✅ CORS origins configured: {len(origins)}")
        for origin in origins:
            print(f"     - {origin}")
    else:
        print(f"  ⚠️  CORS: Allowing all origins")
    
    print()
    
    # Summary
    print("="*70)
    print("📊 Summary:")
    print("="*70)
    
    if errors:
        print(f"\n❌ {len(errors)} Error(s):")
        for error in errors:
            print(f"  {error}")
    
    if warnings:
        print(f"\n⚠️  {len(warnings)} Warning(s):")
        for warning in warnings:
            print(f"  {warning}")
    
    if not errors and not warnings:
        print("\n✅ All environment variables are properly configured!")
    
    print()
    
    if errors:
        print("❌ Cannot start application. Please fix the errors above.")
        print("💡 Tip: Copy .env.example to .env and update the values")
        print()
        return False
    
    if warnings and flask_env == 'production':
        print("⚠️  Application can start but warnings should be addressed for production.")
        print()
    
    return True

if __name__ == '__main__':
    success = check_environment()
    sys.exit(0 if success else 1)
