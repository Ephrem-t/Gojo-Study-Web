# Environment Variables Configuration Guide

This document explains how to configure environment variables for the Gojo HR Web application (both backend and frontend).

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Backend Configuration](#backend-configuration)
3. [Frontend Configuration](#frontend-configuration)
4. [Environment-Specific Setup](#environment-specific-setup)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### First-Time Setup

1. **Backend Setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual values
   pip install -r requirements.txt
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   cp .env.example .env.development
   # Edit .env.development with your actual values
   npm install
   ```

3. **Verify Setup:**
   ```bash
   # Backend
   cd backend
   python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('✅ Env loaded:', os.getenv('FLASK_ENV'))"
   
   # Frontend
   cd frontend
   npm run dev
   # Check console for configuration validation messages
   ```

---

## 🔧 Backend Configuration

### Location: `backend/.env`

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `FLASK_ENV` | Environment mode | `development` | `production` |
| `FLASK_HOST` | Server host | `127.0.0.1` | `0.0.0.0` |
| `FLASK_PORT` | Server port | `5000` | `8080` |
| `SECRET_KEY` | Flask secret key | ⚠️ Required | `random-32-char-string` |
| `PLATFORM_ROOT` | Firebase root node | `Platform1` | `Platform1` |
| `SCHOOL_CODE` | Default school code | ⚠️ Required | `ET-ORO-ADA-GMI` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` | `https://your-domain.com` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `FLASK_DEBUG` | Enable debug mode | `False` | `True` |
| `EMPLOYEE_SUMMARY_CACHE_TTL_SECONDS` | Cache duration | `60` | `300` |
| `MAX_CONTENT_LENGTH` | Max upload size (bytes) | `16777216` | `33554432` |
| `LOG_LEVEL` | Logging level | `INFO` | `DEBUG` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `False` | `True` |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute | `60` | `100` |

### CORS Configuration Examples

**Development (multiple local ports):**
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

**Production (specific domains):**
```env
ALLOWED_ORIGINS=https://hr.gojo-education.com,https://www.hr.gojo-education.com
```

**Allow all (not recommended for production):**
```env
ALLOWED_ORIGINS=*
```

### Starting the Backend

```bash
cd backend
python hr_app.py
```

The app will:
- Load `.env` automatically via `python-dotenv`
- Configure CORS based on `ALLOWED_ORIGINS`
- Use environment-specific settings

---

## 🎨 Frontend Configuration

### Location: `frontend/.env.development` or `frontend/.env.production`

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend API URL | `http://localhost:5000` |
| `VITE_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `gojo-education.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | Firebase database URL | `https://gojo-education-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `gojo-education` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `gojo-education.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID | `579247228743` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | `1:579247228743:web:...` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics measurement ID | - | `G-Q45XN2W3FS` |
| `VITE_APP_NAME` | Application name | `Gojo HR Management` | `Gojo HR (Dev)` |
| `VITE_APP_VERSION` | Application version | `1.0.0` | `1.2.0` |
| `VITE_ENABLE_ANALYTICS` | Enable analytics | `false` | `true` |

### Important Notes about Vite Environment Variables

1. **Prefix Requirement:** All environment variables MUST start with `VITE_` to be exposed to the browser
2. **Build Time:** Variables are embedded at build time, not runtime
3. **Access Method:** Use `import.meta.env.VITE_VARIABLE_NAME` in code

### Starting the Frontend

**Development:**
```bash
cd frontend
npm run dev
# Uses .env.development
```

**Production Build:**
```bash
cd frontend
npm run build
# Uses .env.production
```

**Preview Production Build:**
```bash
cd frontend
npm run preview
```

---

## 🌍 Environment-Specific Setup

### Development Environment

1. **Backend:** `backend/.env`
   ```env
   FLASK_ENV=development
   FLASK_DEBUG=True
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

2. **Frontend:** `frontend/.env.development`
   ```env
   VITE_BACKEND_URL=http://localhost:5000
   VITE_ENABLE_ANALYTICS=false
   ```

### Production Environment

1. **Backend:** `backend/.env` (on production server)
   ```env
   FLASK_ENV=production
   FLASK_DEBUG=False
   SECRET_KEY=<strong-random-key>
   ALLOWED_ORIGINS=https://your-domain.com
   SESSION_COOKIE_SECURE=True
   ```

2. **Frontend:** `frontend/.env.production`
   ```env
   VITE_BACKEND_URL=https://api.your-domain.com
   VITE_ENABLE_ANALYTICS=true
   ```

### Staging Environment

Create `frontend/.env.staging`:
```env
VITE_BACKEND_URL=https://staging-api.your-domain.com
VITE_ENABLE_ANALYTICS=false
```

Build for staging:
```bash
npm run build -- --mode staging
```

---

## 🔒 Security Best Practices

### ✅ DO

1. **Never commit `.env` files to version control**
   - `.env` files are already in `.gitignore`
   - Only commit `.env.example` files

2. **Use strong SECRET_KEY in production**
   ```python
   # Generate a strong key:
   import secrets
   print(secrets.token_hex(32))
   ```

3. **Restrict CORS in production**
   - Never use `ALLOWED_ORIGINS=*` in production
   - Specify exact domains

4. **Use HTTPS in production**
   - Set `SESSION_COOKIE_SECURE=True`
   - Use `https://` URLs only

5. **Rotate secrets regularly**
   - Change `SECRET_KEY` periodically
   - Update service account keys

### ❌ DON'T

1. **Don't hardcode sensitive values in code**
2. **Don't expose backend URLs in client code** (use environment variables)
3. **Don't share `.env` files** (share `.env.example` instead)
4. **Don't use development keys in production**

### Firebase API Keys

**Note:** Firebase API keys in the frontend are **safe to expose** because:
- They identify your Firebase project, not authenticate users
- Security is managed through Firebase Security Rules
- API keys cannot be hidden in web applications (they're in browser code)

However, you should still:
- Configure Firebase Security Rules properly
- Restrict API key usage in Google Cloud Console
- Monitor usage for abuse

---

## 🔍 Troubleshooting

### Backend Issues

**Problem: "Module not found: dotenv"**
```bash
pip install python-dotenv
```

**Problem: "Environment variable not loaded"**
```bash
# Verify .env file exists
ls -la backend/.env

# Check file content
cat backend/.env

# Test loading
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('FLASK_ENV'))"
```

**Problem: "CORS error when accessing API"**
- Check `ALLOWED_ORIGINS` includes your frontend URL
- Verify frontend URL format (no trailing slash)
- Check browser console for exact error

### Frontend Issues

**Problem: "import.meta.env.VITE_BACKEND_URL is undefined"**
- Ensure variable starts with `VITE_` prefix
- Restart dev server after changing `.env` files
- Check file is named correctly (`.env.development`)

**Problem: "Firebase configuration error"**
- Verify all Firebase variables are set
- Check for typos in variable names
- Open browser console to see validation messages

**Problem: "Changes to .env not reflecting"**
```bash
# Stop dev server (Ctrl+C)
# Delete node_modules/.vite cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

### Validation Commands

**Backend:**
```bash
cd backend
python << EOF
from dotenv import load_dotenv
import os
load_dotenv()
print("FLASK_ENV:", os.getenv('FLASK_ENV'))
print("SCHOOL_CODE:", os.getenv('SCHOOL_CODE'))
print("ALLOWED_ORIGINS:", os.getenv('ALLOWED_ORIGINS'))
EOF
```

**Frontend:**
```bash
cd frontend
npm run dev
# Check browser console for validation messages
```

---

## 📝 Checklist for Deployment

### Before Deploying to Production

- [ ] Copy `.env.example` to `.env` on production server
- [ ] Set strong `SECRET_KEY` (32+ random characters)
- [ ] Set `FLASK_ENV=production`
- [ ] Set `FLASK_DEBUG=False`
- [ ] Configure `ALLOWED_ORIGINS` with production domains
- [ ] Set `SESSION_COOKIE_SECURE=True`
- [ ] Update `VITE_BACKEND_URL` to production API URL
- [ ] Enable `VITE_ENABLE_ANALYTICS=true` if needed
- [ ] Test all API endpoints work
- [ ] Verify CORS configuration
- [ ] Check Firebase Security Rules
- [ ] Review Firebase API key restrictions
- [ ] Set up error monitoring/logging

### Deployment Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:5000 hr_app:app

# Frontend
cd frontend
npm install
npm run build
# Serve dist/ folder with nginx/apache
```

---

## 📚 Additional Resources

- [Flask Configuration](https://flask.palletsprojects.com/en/latest/config/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

## 🆘 Getting Help

If you encounter issues:

1. Check this documentation first
2. Review error messages in console/logs
3. Verify all environment variables are set correctly
4. Test with `.env.example` as reference
5. Check Firebase Console for service status

**Last Updated:** 2024-05-08
