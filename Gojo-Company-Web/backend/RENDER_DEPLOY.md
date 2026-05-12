# Render Deployment

This backend is ready to deploy to Render as a Python web service.

## Render Setup

1. Push the repository to GitHub.
2. In Render, choose New +, then Blueprint, and connect this repository.
3. Render will detect [render.yaml](../render.yaml) and create the backend service from it.
4. Fill in the required environment variables before the first deploy.
5. After the service is live, open `/api/health` on the Render URL to verify startup.

If you create the service manually instead of using the blueprint, use these values:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn --bind 0.0.0.0:$PORT gojo_app:app`

## Required Environment Variables

- `FIREBASE_CREDENTIALS_JSON_B64`: Base64-encoded Firebase service account JSON.
- `FIREBASE_DATABASE_URL`: Firebase Realtime Database URL.
- `FIREBASE_STORAGE_BUCKET`: Firebase Storage bucket name.

## Optional Environment Variables

- `FRONTEND_URL`: Single allowed frontend origin, for example `https://gojo-company-web.onrender.com`.
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins.
- `PLATFORM_ROOT`: Defaults to `Platform1`.
- `SCHOOLS_ROOT`: Defaults to `Schools`.
- `FLASK_DEBUG`: Leave this as `0` in Render.

## PowerShell: Encode the Firebase JSON

Run this locally and paste the output into `FIREBASE_CREDENTIALS_JSON_B64`:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw .\backend\your-service-account.json)))
```

## Frontend Follow-Up

Set `VITE_API_BASE_URL` in the frontend deployment to your Render backend URL, for example `https://gojo-company-backend.onrender.com`.

## Storage Caveat

If Firebase Storage upload fails, this backend falls back to saving files under `backend/uploaded_assets`. Render local disk is ephemeral, so those fallback uploads will not persist across restarts or redeploys. Keep Firebase Storage configured correctly if you need durable uploads.