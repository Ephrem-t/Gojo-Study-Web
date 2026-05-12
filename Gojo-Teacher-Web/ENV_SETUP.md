# Gojo Teacher Environment Setup

The backend now loads Firebase credentials only from environment configuration.

Required variables:

- `FLASK_SECRET_KEY`: random secret used to sign the teacher session cookie
- `FIREBASE_DATABASE_URL`: Firebase Realtime Database URL
- `FIREBASE_STORAGE_BUCKET`: Firebase Storage bucket name
- `FIREBASE_CREDENTIALS` or `FIREBASE_CREDENTIALS_PATH`: Firebase Admin SDK credentials as inline JSON or a local file path

Recommended production variables:

- `APP_ENV=production`
- `SESSION_COOKIE_SECURE=1`
- `ALLOWED_ORIGINS=https://your-teacher-domain.example`

Example PowerShell session:

```powershell
$env:APP_ENV = "production"
$env:FLASK_SECRET_KEY = "replace-with-a-long-random-secret"
$env:FIREBASE_DATABASE_URL = "https://your-project-default-rtdb.firebaseio.com"
$env:FIREBASE_STORAGE_BUCKET = "your-project.appspot.com"
$env:FIREBASE_CREDENTIALS_PATH = "C:\\secure\\gojo-teacher-adminsdk.json"
```

Do not commit Firebase service-account JSON files into this repository.