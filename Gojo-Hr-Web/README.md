# Gojo HR Web

This package contains the production-facing commands and maintenance notes for the HR web app.

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- Firebase project with Realtime Database and Storage

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   cd Gojo-Hr-Web
   npm install
   cd frontend
   npm install
   cd ../backend
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   
   # Frontend
   cd ../frontend
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

3. **Validate setup:**
   ```bash
   # Check backend environment
   cd backend
   python check_env.py
   
   # Build frontend
   cd ../frontend
   npm run build
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   python start.py
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

📖 **For detailed environment variable configuration, see [ENV_SETUP.md](ENV_SETUP.md)**

## Production Cost Controls

- Realtime Database school resolution is cached in the backend to avoid repeated full `Platform1/Schools` reads.
- Employee summary reads now use an in-process backend TTL cache and a frontend session cache.
- HR chat metadata is summary-first under `Chat_Summaries`, so HR no longer writes duplicate `Chats/<chatId>/lastMessage` and `Chats/<chatId>/unread` metadata.
- New HR profile image uploads and post media uploads use immutable cache headers to reduce Firebase Storage egress.
- Post feed loading is paginated and dashboard summary requests are cached client-side.

## Top-Level Commands

- `npm run build`
Build the HR frontend for production.

- `npm run preview`
Preview the production frontend build locally.

- `npm run start:backend`
Run the Flask HR backend.

- `npm run validate:backend`
Compile-check the main backend and maintenance scripts.

- `npm run estimate:hr-cost`
Run the Firebase cost estimation script.

- `npm run backfill:post-previews:dry-run`
Preview which HR post previews would be generated.

- `npm run backfill:post-previews`
Generate and upload missing HR post preview images.

- `npm run backfill:profile-cache:dry-run`
Preview which existing HR profile images would receive immutable cache headers.

- `npm run backfill:profile-cache`
Apply immutable cache headers to referenced HR profile images already in Firebase Storage.

## Environment Configuration

### Backend Environment Variables

Configuration file: `backend/.env`

#### Required Variables

- `SCHOOL_CODE` - Default school code identifier (e.g., `ET-ORO-ADA-GMI`)
- `SECRET_KEY` - Flask secret key for sessions (must be changed in production!)

#### Recommended Variables

- `FLASK_ENV` - Environment mode (`development` or `production`)
- `FLASK_HOST` - Server host address (default: `127.0.0.1`)
- `FLASK_PORT` - Server port (default: `5000`)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)
  - Development: `http://localhost:5173,http://localhost:3000`
  - Production: `https://your-domain.com`

#### Optional Variables

- `PLATFORM_ROOT` - Firebase platform root node (default: `Platform1`)
- `EMPLOYEE_SUMMARY_CACHE_TTL_SECONDS` - Backend cache TTL (default: `60` seconds)
- `MAX_CONTENT_LENGTH` - Maximum upload size in bytes (default: `16777216` / 16MB)
- `LOG_LEVEL` - Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`)
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: `False`)

### Frontend Environment Variables

Configuration files: 
- Development: `frontend/.env.development`
- Production: `frontend/.env.production`

#### Required Variables (all prefixed with `VITE_`)

- `VITE_BACKEND_URL` - Backend API URL
  - Development: `http://localhost:5000`
  - Production: `https://api.your-domain.com`

- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID

#### Optional Variables

- `VITE_FIREBASE_MEASUREMENT_ID` - Google Analytics measurement ID
- `VITE_APP_NAME` - Application name
- `VITE_APP_VERSION` - Application version
- `VITE_ENABLE_ANALYTICS` - Enable analytics (`true` or `false`)

### Environment Setup Commands

**Validate backend environment:**
```bash
cd backend
python check_env.py
```

**Test backend environment loading:**
```bash
cd backend
python test_env.py
```

**Start backend with environment validation:**
```bash
cd backend
python start.py
```

### Security Notes

- Firebase credentials and storage bucket settings are loaded through `backend/firebase_config.py`, which resolves the shared `serviceAccountKey.py`
- Firebase Web API keys in frontend are safe to expose (security is managed through Firebase Security Rules)
- **Never commit `.env` files** - they are excluded in `.gitignore`
- Only commit `.env.example` files as templates
- Use strong `SECRET_KEY` in production (32+ random characters)
- Restrict CORS origins in production (never use `*`)

## Production Checklist

1. **Environment Configuration:**
   - [ ] Copy `.env.example` to `.env` in backend
   - [ ] Set strong `SECRET_KEY` (not the development default)
   - [ ] Configure `ALLOWED_ORIGINS` with production domains
   - [ ] Set `FLASK_ENV=production` and `FLASK_DEBUG=False`
   - [ ] Update frontend `.env.production` with production backend URL
   - [ ] Set `SESSION_COOKIE_SECURE=True` for HTTPS

2. **Dependencies:**
   - [ ] Install root dependencies: `npm install` in `Gojo-Hr-Web`
   - [ ] Install frontend dependencies: `npm install` in `frontend/`
   - [ ] Install backend dependencies: `pip install -r requirements.txt` in `backend/`

3. **Validation:**
   - [ ] Run backend environment check: `cd backend && python check_env.py`
   - [ ] Validate backend syntax: `npm run validate:backend`
   - [ ] Build frontend: `npm run build`

4. **Maintenance Commands:**
   - [ ] Run dry-run before any write operation:
     - `npm run backfill:post-previews:dry-run`
     - `npm run backfill:profile-cache:dry-run`

5. **Deployment:**
   - [ ] Start backend: `npm run start:backend` (behind production process manager or reverse proxy)
   - [ ] Serve frontend `dist/` folder with nginx/apache
   - [ ] Configure HTTPS and SSL certificates
   - [ ] Set up Firebase Security Rules
   - [ ] Configure monitoring and logging

## Current Backfill Status

- The latest `backfill:profile-cache` dry-run across all schools returned `candidateCount: 0`, so there are no currently referenced HR profile images waiting for cache-header updates.

## 📚 Additional Documentation

- [ENV_SETUP.md](ENV_SETUP.md) - Comprehensive environment variables guide
- [backend/check_env.py](backend/check_env.py) - Environment validation script
- [backend/start.py](backend/start.py) - Backend startup script with validation