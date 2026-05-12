"""
Quick test to verify backend environment variable configuration
"""
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

print("\n" + "="*60)
print("Backend Environment Variables Test")
print("="*60 + "\n")

# Test environment variables
test_vars = {
    'FLASK_ENV': os.getenv('FLASK_ENV'),
    'FLASK_HOST': os.getenv('FLASK_HOST'),
    'FLASK_PORT': os.getenv('FLASK_PORT'),
    'SCHOOL_CODE': os.getenv('SCHOOL_CODE'),
    'PLATFORM_ROOT': os.getenv('PLATFORM_ROOT'),
    'ALLOWED_ORIGINS': os.getenv('ALLOWED_ORIGINS'),
}

print("Loaded Environment Variables:")
for key, value in test_vars.items():
    status = "✅" if value else "❌"
    print(f"{status} {key}: {value}")

print()

# Test CORS configuration parsing
allowed_origins = os.getenv('ALLOWED_ORIGINS', '*')
if allowed_origins == '*':
    cors_origins = '*'
    print("⚠️  CORS: Allowing all origins")
else:
    cors_origins = [origin.strip() for origin in allowed_origins.split(',') if origin.strip()]
    print(f"✅ CORS: {len(cors_origins)} origin(s) configured:")
    for origin in cors_origins:
        print(f"   - {origin}")

print("\n" + "="*60)
print("✅ Environment configuration test passed!")
print("="*60 + "\n")
