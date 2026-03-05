import os
import sys
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, db

BASE = os.path.join(os.path.dirname(__file__), '..')
FIREBASE_JSON = os.path.join(BASE, 'bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json')
if not os.path.exists(FIREBASE_JSON):
    print(f"Firebase JSON not found: {FIREBASE_JSON}")
    sys.exit(1)

cred = credentials.Certificate(FIREBASE_JSON)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://bale-house-rental-default-rtdb.firebaseio.com/'
})

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
