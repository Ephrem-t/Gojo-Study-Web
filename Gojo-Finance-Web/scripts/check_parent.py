import os
import sys
import firebase_admin
from firebase_admin import credentials, db

BASE = os.path.join(os.path.dirname(__file__), '..')
FIREBASE_JSON = os.path.join(BASE, 'bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json')
if not os.path.exists(FIREBASE_JSON):
    print(f"Firebase JSON not found: {FIREBASE_JSON}")
    sys.exit(1)

cred = credentials.Certificate(FIREBASE_JSON)
try:
    firebase_admin.get_app()
except Exception:
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://bale-house-rental-default-rtdb.firebaseio.com/'
    })

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
