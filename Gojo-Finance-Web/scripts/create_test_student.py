import os
import sys
from datetime import datetime
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
firebase_admin.initialize_app(cred, get_firebase_options())

school_code = 'TEST_SCHOOL'
student_id = 'GES_0001_26'
student_ref = db.reference(f"Platform1/Schools/{school_code}/Students/{student_id}")
student_ref.set({
    'studentId': student_id,
    'name': 'Test Student',
    'class': '1A',
    'createdAt': datetime.utcnow().isoformat()
})
print('Created student:', student_id)
