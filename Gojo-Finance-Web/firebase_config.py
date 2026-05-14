from pathlib import Path


FIREBASE_CREDENTIALS = str((Path(__file__).resolve().parent / "gojo-education-firebase-adminsdk-fbsvc-dd7c417a41.json"))
FIREBASE_DATABASE_URL = "https://gojo-education-default-rtdb.firebaseio.com"
FIREBASE_STORAGE_BUCKET = "gojo-education.firebasestorage.app"


def get_firebase_options():
    return {
        "databaseURL": FIREBASE_DATABASE_URL,
        "storageBucket": FIREBASE_STORAGE_BUCKET,
    }


def require_firebase_credentials():
    cred_path = Path(FIREBASE_CREDENTIALS)
    if not cred_path.exists():
        raise FileNotFoundError(f"Firebase credentials file not found: {cred_path}")
    return str(cred_path)