import os
import sys
import firebase_admin
from firebase_admin import credentials, db
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials

firebase_json = require_firebase_credentials()
if not os.path.exists(firebase_json):
    print(f"Firebase JSON not found: {firebase_json}")
    sys.exit(1)

cred = credentials.Certificate(firebase_json)
try:
    firebase_admin.get_app()
except Exception:
    firebase_admin.initialize_app(cred, get_firebase_options())

school_code = 'TEST_SCHOOL'
root = db.reference(f"Platform1/Schools/{school_code}")
parents = root.child('Parents').get() or {}
users = root.child('Users').get() or {}
print('Parents:')
for k,v in (parents or {}).items():
    print(k, v)
print('\nUsers:')
for k,v in (users or {}).items():
    print(k, v)

# Check student parent link
student_id = 'GES_0001_26'
student_parents = root.child(f"Students/{student_id}/parents").get() or {}
print(f"\nStudent {student_id} parents:", student_parents)
