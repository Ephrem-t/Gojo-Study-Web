from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
import threading
import time as _time
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime, timedelta
import sys
import re
import secrets
from urllib.parse import unquote
from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials


# ---- server-side posts cache (shared across all admin sessions) ----
_POSTS_CACHE: dict = {}
_POSTS_CACHE_LOCK = threading.Lock()
_POSTS_CACHE_TTL = 2 * 60  # seconds

def _pc_get(key: str):
    with _POSTS_CACHE_LOCK:
        entry = _POSTS_CACHE.get(key)
        if entry and (_time.monotonic() - entry["ts"]) < _POSTS_CACHE_TTL:
            return entry["data"]
        return None

def _pc_set(key: str, data):
    with _POSTS_CACHE_LOCK:
        _POSTS_CACHE[key] = {"data": data, "ts": _time.monotonic()}

def _pc_invalidate(key: str):
    with _POSTS_CACHE_LOCK:
        _POSTS_CACHE.pop(key, None)

def _pc_invalidate_prefix(prefix: str):
    with _POSTS_CACHE_LOCK:
        for key in list(_POSTS_CACHE.keys()):
            if str(key).startswith(prefix):
                _POSTS_CACHE.pop(key, None)
# --------------------------------------------------------------------

APP_ENV = str(os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").strip().lower()


def _parse_allowed_origins():
    raw = str(os.getenv("ALLOWED_ORIGINS") or "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # In development allow localhost frontends; in production this MUST be set via env
    if APP_ENV == "production":
        raise RuntimeError("ALLOWED_ORIGINS env var must be set in production (comma-separated list of allowed frontend origins).")
    return ["http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://localhost:5173", "http://localhost:5174"]


def _read_secret_key():
    key = str(os.getenv("FLASK_SECRET_KEY") or os.getenv("APP_SECRET_KEY") or "").strip()
    if key:
        return key
    if APP_ENV == "production":
        raise RuntimeError("FLASK_SECRET_KEY or APP_SECRET_KEY must be set in production.")
    return "gojo-admin-dev-secret-key-not-for-production"


app = Flask(__name__)
app.config.update(
    SECRET_KEY=_read_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=APP_ENV == "production",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
)
CORS(app, resources={r"/*": {"origins": _parse_allowed_origins()}}, supports_credentials=True)

# ---------------- FIREBASE ---------------- #
firebase_json = require_firebase_credentials()
if not os.path.exists(firebase_json):
    print(f"Firebase JSON missing at {firebase_json}")
    sys.exit(1)

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, get_firebase_options())
bucket = storage.bucket()

# ---------------- REFERENCES ---------------- #
PLATFORM_ROOT = "Platform1"


def platform_ref(path=""):
    base = PLATFORM_ROOT.strip("/")
    clean = str(path or "").strip("/")
    full_path = f"{base}/{clean}" if clean else base
    return db.reference(full_path)


def school_node_ref(school_code, node_name):
    code = str(school_code or "").strip()
    return platform_ref(f"Schools/{code}/{node_name}")


def all_schools_snapshot():
    return platform_ref("Schools").get() or {}


def parse_positive_int(value, default_value, min_value=1, max_value=100):
    try:
        parsed_value = int(value)
    except (TypeError, ValueError):
        parsed_value = default_value

    return max(min_value, min(max_value, parsed_value))


def read_recent_posts_for_school(school_code, limit=60):
    code = str(school_code or "").strip()
    if not code:
        return {}

    cache_key = f"posts:{code}:{limit}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return cached

    try:
        posts = school_node_ref(code, "Posts").order_by_key().limit_to_last(limit).get() or {}
        result = posts if isinstance(posts, dict) else {}
    except Exception:
        result = {}

    _pc_set(cache_key, result)
    return result


def resolve_school_code_alias(school_code):
    code = str(school_code or "").strip()
    if not code:
        return ""

    if read_recent_posts_for_school(code, limit=1):
        return code

    try:
        school_keys = platform_ref("Schools").get(shallow=True) or {}
        if isinstance(school_keys, dict):
            normalized_code = code.lower()
            for school_key in school_keys.keys():
                normalized_key = str(school_key or "").strip().lower()
                if (
                    normalized_key == normalized_code
                    or normalized_key.endswith(f"-{normalized_code}")
                    or normalized_key.startswith(f"{normalized_code}-")
                    or f"-{normalized_code}-" in normalized_key
                ):
                    return str(school_key)
    except Exception:
        pass

    try:
        matches = platform_ref("Schools").order_by_child("schoolInfo/shortName").equal_to(code).limit_to_first(1).get() or {}
        if isinstance(matches, dict) and matches:
            return next(iter(matches.keys()))
    except Exception:
        pass

    try:
        matches = platform_ref("Schools").order_by_child("schoolInfo/schoolCode").equal_to(code).limit_to_first(1).get() or {}
        if isinstance(matches, dict) and matches:
            return next(iter(matches.keys()))
    except Exception:
        pass

    return code


def load_post_actor_profiles(school_code, posts):
    actor_ids = {
        str((post or {}).get("adminId") or (post or {}).get("userId") or "").strip()
        for post in posts
        if isinstance(post, dict) and str((post or {}).get("adminId") or (post or {}).get("userId") or "").strip()
    }
    profiles = {}

    for actor_id in actor_ids:
        user = school_node_ref(school_code, f"Users/{actor_id}").get() or {}
        if not isinstance(user, dict):
            user = {}

        admin_record = {}
        if not user:
            admin_record = school_node_ref(school_code, f"School_Admins/{actor_id}").get() or {}
            if isinstance(admin_record, dict) and admin_record.get("userId"):
                user = school_node_ref(school_code, f"Users/{admin_record.get('userId')}").get() or {}

        if not isinstance(admin_record, dict):
            admin_record = {}
        if not isinstance(user, dict):
            user = {}

        profiles[actor_id] = {
            "name": user.get("name") or admin_record.get("name") or "Admin",
            "profileImage": user.get("profileImage") or admin_record.get("profileImage") or "/default-profile.png",
            "userId": user.get("userId") or admin_record.get("userId") or actor_id,
        }

    return profiles


def _merged_dict(*nodes):
    merged = {}
    for node in nodes:
        if isinstance(node, dict):
            merged.update(node)
    return merged


def _normalize_users_node(users_node):
    normalized = {}
    if not isinstance(users_node, dict):
        return normalized

    for user_key, user_value in users_node.items():
        if not isinstance(user_value, dict):
            continue

        normalized_user = dict(user_value)
        normalized_user["userId"] = str(
            normalized_user.get("userId") or user_key or ""
        ).strip()
        normalized[str(user_key)] = normalized_user

    return normalized


def get_users_snapshot():
    """Read users from all schools under Platform1/Schools/*/Users."""
    users = {}
    schools = all_schools_snapshot()
    for school in schools.values():
        if not isinstance(school, dict):
            continue
        school_users = school.get("Users") or {}
        users.update(_normalize_users_node(school_users))
    return users


def get_users_snapshot_for_school(school_code):
    return _normalize_users_node(school_node_ref(school_code, "Users").get() or {})


def get_school_admins_snapshot():
    """Read admins from all schools under Platform1/Schools/*/School_Admins."""
    admins = {}
    schools = all_schools_snapshot()
    for school in schools.values():
        if not isinstance(school, dict):
            continue
        school_admins = school.get("School_Admins") or {}
        if isinstance(school_admins, dict):
            admins.update(school_admins)
    return admins


def get_school_admins_snapshot_for_school(school_code):
    return school_node_ref(school_code, "School_Admins").get() or {}


def get_registerers_snapshot():
    """Read registerers from all schools under Platform1/Schools/*/Registerers."""
    registerers = {}
    schools = all_schools_snapshot()
    for school in schools.values():
        if not isinstance(school, dict):
            continue
        school_registerers = school.get("Registerers") or {}
        if isinstance(school_registerers, dict):
            registerers.update(school_registerers)
    return registerers


def get_school_options():
    """Build selectable school options from DB with safe defaults."""
    options = []

    try:
        school_keys_node = platform_ref("Schools").get(shallow=True) or {}
    except TypeError:
        school_keys_node = platform_ref("Schools").get() or {}

    if isinstance(school_keys_node, dict):
        for key in school_keys_node.keys():
            school_info = school_node_ref(key, "schoolInfo").get() or {}
            if not isinstance(school_info, dict):
                school_info = {}
            options.append({
                "code": key,
                "shortName": school_info.get("shortName") or school_info.get("short_name") or "SCH",
                "name": school_info.get("name") or key,
            })

    deduped = []
    seen = set()
    for item in options:
        code = str(item.get("code") or "").strip() or "ET-ORO-ADA-GMI"
        short_name = str(item.get("shortName") or "").strip() or "SCH"
        name = str(item.get("name") or "").strip() or "School"
        key = (code, short_name)
        if key in seen:
            continue
        seen.add(key)
        deduped.append({"code": code, "shortName": short_name, "name": name})

    if not deduped:
        deduped = [{"code": "ET-ORO-ADA-GMI", "shortName": "GMI", "name": "Guda Miju"}]

    return deduped


def resolve_user_from_any(identity):
    """Resolve a user from userId, username, adminId, or registererId."""
    if not identity:
        return None

    users = get_users_snapshot()

    # Direct userId key lookup
    direct_user = users.get(str(identity))
    if direct_user:
        return direct_user

    # Match by userId or username
    for user in users.values():
        if str(user.get("userId")) == str(identity) or str(user.get("username")) == str(identity):
            return user

    # Primary mapping: Schools/<schoolCode>/School_Admins/<adminId> -> userId
    schools_node = all_schools_snapshot()
    for school in schools_node.values():
        if not isinstance(school, dict):
            continue
        school_admins = school.get("School_Admins") or {}
        admin = school_admins.get(str(identity)) if isinstance(school_admins, dict) else None
        if admin and admin.get("userId"):
            mapped = users.get(admin.get("userId"))
            if mapped:
                return mapped

        if isinstance(school_admins, dict):
            for admin_item in school_admins.values():
                if str(admin_item.get("adminId")) == str(identity) and admin_item.get("userId"):
                    mapped = users.get(admin_item.get("userId"))
                    if mapped:
                        return mapped

    # New structure mapping: Registerers/<registererId>
    registerers = get_registerers_snapshot()
    reg = registerers.get(str(identity))
    if reg and reg.get("userId"):
        mapped = users.get(reg.get("userId"))
        if mapped:
            return mapped

    for reg_item in registerers.values():
        if str(reg_item.get("registererId")) == str(identity) and reg_item.get("userId"):
            mapped = users.get(reg_item.get("userId"))
            if mapped:
                return mapped

    return None


def find_user_for_login(username, password):
    """Find user by username/password with one pass over users."""
    target_username = _norm_text(username)
    target_password = _norm_text(password)
    if not target_username or not target_password:
        return None

    target_upper = target_username.upper()
    case_insensitive_match = None

    users = get_users_snapshot()
    for user in users.values():
        if _norm_text(user.get("password")) != target_password:
            continue

        current_username = _norm_text(user.get("username"))
        if current_username == target_username:
            return user

        if case_insensitive_match is None and current_username.upper() == target_upper:
            case_insensitive_match = user

    return case_insensitive_match


def resolve_admin_identifiers_from_user(user):
    """Return normalized admin identifiers for a known user object."""
    if not user:
        return None

    user_id = str(user.get("userId") or "")
    username = str(user.get("username") or "")

    admin_id = ""
    school_code = str(user.get("schoolCode") or "")
    if school_code:
        school_admins = get_school_admins_snapshot_for_school(school_code)
        for a in school_admins.values():
            if str(a.get("userId")) == user_id:
                admin_id = str(a.get("adminId") or "")
                break

    if not admin_id:
        schools_node = all_schools_snapshot()
        for code, school in schools_node.items():
            if not isinstance(school, dict):
                continue
            school_admins = school.get("School_Admins") or {}
            if not isinstance(school_admins, dict):
                continue
            for a in school_admins.values():
                if str(a.get("userId")) == user_id:
                    admin_id = str(a.get("adminId") or "")
                    school_code = str(code)
                    break
            if admin_id:
                break

    # Backward fallback: Registerers mapping
    if not admin_id:
        registerers = get_registerers_snapshot()
        for r in registerers.values():
            if str(r.get("userId")) == user_id:
                admin_id = str(r.get("registererId") or "")
                break

    if not admin_id:
        return None

    return {
        "user": user,
        "userId": user_id,
        "adminId": admin_id,
        "username": username,
        "schoolCode": school_code,
    }


def resolve_admin_identifiers(identity):
    """Return normalized IDs preferring School_Admins mapping."""
    user = resolve_user_from_any(identity)
    return resolve_admin_identifiers_from_user(user)


@app.route("/api/schools", methods=["GET"])
def list_schools():
    return jsonify({"success": True, "schools": get_school_options()})


def _norm_text(value):
    return str(value).strip() if value is not None else ""


def _normalized_role(value):
    return _norm_text(value).lower()


def _is_admin_role(value):
    role = _normalized_role(value).replace("-", "_")
    return role in {"school_admins", "school_admin", "admin", "admins"}

# ---------------- FILE UPLOAD ---------------- #
def upload_file_to_firebase(file, folder=""):
    try:
        filename = secure_filename(file.filename)
        unique_name = f"{folder}/{uuid.uuid4().hex}_{filename}"
        blob = bucket.blob(unique_name)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print("Upload Error:", e)
        return ""


def _delete_old_profile_image(old_url):
    """Delete a previous Storage profile image if the URL points to this bucket."""
    if not old_url or not isinstance(old_url, str):
        return
    if "firebasestorage.googleapis.com" not in old_url and "storage.googleapis.com" not in old_url:
        return
    try:
        from urllib.parse import urlparse, unquote
        parsed = urlparse(old_url)
        # public URL format: storage.googleapis.com/<bucket>/<object>
        parts = parsed.path.lstrip("/").split("/", 1)
        if len(parts) == 2:
            object_name = unquote(parts[1])
            blob = bucket.blob(object_name)
            blob.delete()
    except Exception:
        pass  # Best-effort: never fail the upload because of old-file cleanup


@app.route("/api/upload-profile-image", methods=["POST"])
def upload_profile_image():
    """Upload a profile image to Firebase Storage and return the public URL.
    Also patches Users and optional directory nodes in RTDB with the URL.
    """
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"success": False, "message": "No file provided"}), 400

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        return jsonify({"success": False, "message": "Invalid file type. Use JPG, PNG, WEBP or GIF."}), 400

    user_id = _norm_text(request.form.get("userId") or "")
    school_code = _norm_text(request.form.get("schoolCode") or "")
    old_url = _norm_text(request.form.get("oldUrl") or "")

    folder = f"profile_images/{school_code}" if school_code else "profile_images"
    public_url = upload_file_to_firebase(file, folder)
    if not public_url:
        return jsonify({"success": False, "message": "Storage upload failed"}), 500

    # Best-effort: delete old Storage file to avoid orphaned blobs
    _delete_old_profile_image(old_url)

    # Best-effort: patch RTDB Users node with the new URL
    if user_id and school_code:
        try:
            users_ref = school_node_ref(school_code, "Users")
            # Try direct key first, then query by userId field
            direct = users_ref.child(user_id).get()
            if direct:
                users_ref.child(user_id).update({"profileImage": public_url})
            else:
                matches = users_ref.order_by_child("userId").equal_to(user_id).limit_to_first(1).get()
                for push_key in (matches or {}).keys():
                    users_ref.child(push_key).update({"profileImage": public_url})
        except Exception:
            pass  # Don't fail the upload if the RTDB patch fails

    return jsonify({"success": True, "url": public_url})


def register_admin():
    data = request.form
    name = data.get("name")
    password = data.get("password")
    email = data.get("email")
    gender = data.get("gender")
    phone = data.get("phone")
    title = data.get("title")
    school_code = data.get("schoolCode")
    school_short_name = data.get("schoolShortName")
    profile = request.files.get("profile")

    # Check required fields (username removed, will be generated)
    if not name or not password or not email:
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    school_options = get_school_options()
    if not school_code:
        school_code = school_options[0].get("code")

    users_ref = school_node_ref(school_code, "Users")
    admins_ref = school_node_ref(school_code, "School_Admins")

    if not school_short_name:
        matched = next((s for s in school_options if str(s.get("code")) == str(school_code)), None)
        if matched:
            school_short_name = matched.get("shortName")

    school_short_name = str(school_short_name or "SCH").strip()
    short_code = re.sub(r"[^A-Za-z0-9]", "", school_short_name).upper() or "SCH"

    counters_ref = school_node_ref(school_code, f"counters/school_admins_by_school/{short_code}")

    # Email duplicate check
    users = get_users_snapshot_for_school(school_code)
    for u in users.values():
        if u.get("email") == email:
            return jsonify({"success": False, "message": "Email already in use!"}), 400

    # ==== Atomic adminId generation: SHORTNAME + A_0001_YY
    year_suf = str(datetime.utcnow().year)[-2:]
    id_prefix = f"{short_code}A"
    try:
        # Defensive: scan max existing value for this school prefix.
        existing_admins = get_school_admins_snapshot_for_school(school_code)
        max_found = 0
        for adm in existing_admins.values():
            aid = adm.get("adminId") or ""
            if aid.startswith(f"{id_prefix}_"):
                parts = aid.split('_')
                if len(parts) == 3:
                    try:
                        seq = int(parts[1].lstrip("0") or "0")
                        if seq > max_found:
                            max_found = seq
                    except Exception:
                        continue

        # Counter bump up
        curr_counter = counters_ref.get() or 0
        if curr_counter < max_found:
            counters_ref.set(max_found)

        def tx_inc(val): return (val or 0) + 1
        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int): new_seq = int(new_seq)
        num_padded = str(new_seq).zfill(4)
        admin_id = f"{id_prefix}_{num_padded}_{year_suf}"

        # Unlikely collision: increment until unique on School_Admins.
        attempts = 0
        while admins_ref.child(admin_id).get():
            new_seq += 1
            num_padded = str(new_seq).zfill(4)
            admin_id = f"{id_prefix}_{num_padded}_{year_suf}"
            attempts += 1
            if attempts > 1000:
                admin_id = f"{id_prefix}_{str(int(datetime.utcnow().timestamp()))[-4:]}_{year_suf}"
                break
    except Exception:
        admin_id = f"{id_prefix}_{str(int(datetime.utcnow().timestamp()))[-4:]}_{year_suf}"

    # Profile image if present
    profile_url = ""
    if profile:
        filename = f"profiles/{profile.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile, content_type=profile.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # ==== Create user (username = adminId by default)
    new_user = users_ref.push()
    user_data = {
        "userId": new_user.key,
        "name": name,
        "username": admin_id,
        "password": password,
        "email": email,
        "gender": gender,
        "phone": phone,
        "profileImage": profile_url,
        "role": "school_admins",
        "employeeId": admin_id,
        "schoolCode": school_code,
        "isActive": True,
    }
    new_user.set(user_data)

    admins_ref.child(admin_id).set({
        "adminId": admin_id,
        "userId": new_user.key,
        "title": title,
        "email": email,
        "phone": phone,
        "schoolCode": school_code,
        "schoolShortName": short_code,
        "status": "active",
        "createdAt": datetime.utcnow().isoformat(),
    })

    return jsonify({
        "success": True,
        "message": "Registration successful!",
        "adminId": admin_id,
        "schoolPath": f"/{PLATFORM_ROOT}/Schools/{school_code}"
    })

# ---------------- LOGIN ADMIN ---------------- #
@app.route("/api/login", methods=["POST"])
def login_admin():
    try:
        data = request.get_json(force=True)
        username = _norm_text(data.get("username"))
        password = _norm_text(data.get("password"))

        if not username or not password:
            return jsonify({"success": False, "message": "Username and password are required"}), 400

        matched_user = find_user_for_login(username, password)

        if not matched_user:
            return jsonify({"success": False, "message": "Invalid username or password"})

        role = _normalized_role(matched_user.get("role"))
        if not _is_admin_role(role):
            return jsonify({"success": False, "message": "Only users with role = school_admins can login here"}), 403

        resolved = resolve_admin_identifiers_from_user(matched_user)
        if not resolved:
            if _is_admin_role(role):
                return jsonify({"success": False, "message": "School_Admins record missing for this user"}), 403

            return jsonify({"success": False, "message": "Only school_admins accounts can login here"}), 403

        return jsonify({
            "success": True,
            "message": "Login success",
            "adminId": resolved.get("adminId"),
            "userId": matched_user.get("userId"),
            "name": matched_user.get("name"),
            "username": matched_user.get("username"),
            "role": role,
            "schoolCode": resolved.get("schoolCode"),
            "profileImage": matched_user.get("profileImage", "")
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ---------------- CREATE POST ---------------- #
@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        data = request.form
        text = data.get("message", "")
        adminId = data.get("adminId")
        userId = data.get("userId")
        media_file = request.files.get("post_media")

        if not adminId and not userId:
            return jsonify({"success": False, "message": "Admin not logged in"})

        resolved = resolve_admin_identifiers(userId or adminId) or resolve_admin_identifiers(adminId)
        if not resolved:
            return jsonify({"success": False, "message": "Unknown admin identity"}), 400

        post_url = ""
        if media_file:
            post_url = upload_file_to_firebase(media_file, folder="posts")

        school_code = resolve_school_code_alias(data.get("schoolCode") or resolved.get("schoolCode"))
        if not school_code:
            return jsonify({"success": False, "message": "Admin school not found"}), 400

        post_ref = school_node_ref(school_code, "Posts").push()
        time_now = datetime.utcnow().isoformat()
        
        admin_user_id = resolved.get("userId") or userId or adminId
        admin_name = data.get("adminName") or (resolved.get("user") or {}).get("name") or "Admin"
        admin_profile = data.get("adminProfile") or (resolved.get("user") or {}).get("profileImage") or "/default-profile.png"
        
        post_ref.set({
            "postId": post_ref.key,
            "message": text,
            "postUrl": post_url,
            "adminId": admin_user_id,
            "userId": admin_user_id,
            "adminName": admin_name,
            "adminProfile": admin_profile,
            "schoolCode": school_code,
            "targetRole": data.get("targetRole") or "all",
            "time": time_now,
            "createdAt": time_now,
            "likeCount": 0,
            "likes": {},
            "seenBy": {
                admin_user_id: True
            }
        })

        _pc_invalidate(f"posts:{school_code}:60")
        _pc_invalidate_prefix(f"my_posts:{school_code}:")
        return jsonify({"success": True, "message": "Post created successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---------------- GET ALL POSTS ---------------- #
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    def normalize_posts_node(posts_node, school_code=""):
        normalized = {}
        if not isinstance(posts_node, dict):
            return normalized

        # Handle legacy shape where Posts contains a single post object directly.
        if "postId" in posts_node and ("message" in posts_node or "postUrl" in posts_node):
            normalized[str(posts_node.get("postId") or f"{school_code}-legacy-post")] = posts_node
            return normalized

        for raw_key, raw_value in posts_node.items():
            if not isinstance(raw_value, dict):
                continue

            if "postId" not in raw_value and "message" not in raw_value and "postUrl" not in raw_value:
                continue

            normalized[str(raw_value.get("postId") or raw_key)] = raw_value

        return normalized

    requested_school_code = (request.args.get("schoolCode") or "").strip()
    limit = parse_positive_int(request.args.get("limit"), 60, 1, 100)
    resolved_school_code = resolve_school_code_alias(requested_school_code)

    if not resolved_school_code:
        return jsonify([])

    all_posts = normalize_posts_node(
        read_recent_posts_for_school(resolved_school_code, limit),
        resolved_school_code,
    )
    post_list = []
    ordered_posts = sorted(
        all_posts.items(),
        key=lambda item: str((item[1] or {}).get("time") or (item[1] or {}).get("createdAt") or item[0]),
        reverse=True,
    )[:limit]
    actor_profiles = load_post_actor_profiles(resolved_school_code, [post for _, post in ordered_posts])

    for key, post in ordered_posts:
        if not isinstance(post, dict):
            continue

        actor_id = str(post.get("adminId") or post.get("userId") or "").strip()
        user_data = actor_profiles.get(actor_id, {})
        
        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "userId": post.get("userId") or user_data.get("userId"),
            "targetRole": post.get("targetRole", "all"),
            "schoolCode": post.get("schoolCode") or resolved_school_code,
            "adminName": user_data.get("name") or post.get("adminName") or "Admin",
            "adminProfile": user_data.get("profileImage") or post.get("adminProfile") or "/default-profile.png",
            "time": post.get("time"),
            "likes": post.get("likes", {}),
            "likeCount": post.get("likeCount", 0),
            "seenBy": post.get("seenBy", {})
        })

    return jsonify(post_list)


@app.route("/api/overview", methods=["GET"])
def get_overview_data():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)
    if not resolved_school_code:
        return jsonify({"students": [], "parentsCount": 0, "postsCount": 0})

    cache_key = f"overview:{resolved_school_code}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        parents_shallow = school_node_ref(resolved_school_code, "Parents").get(shallow=True) or {}
    except Exception:
        parents_shallow = {}
    try:
        posts_shallow = school_node_ref(resolved_school_code, "Posts").get(shallow=True) or {}
    except Exception:
        posts_shallow = {}

    student_directory = school_node_ref(resolved_school_code, "StudentDirectory").get() or {}
    if not isinstance(student_directory, dict):
        student_directory = {}

    # Fallback to Students only when directory is empty.
    if not student_directory:
        students_node = school_node_ref(resolved_school_code, "Students").get() or {}
        if isinstance(students_node, dict):
            student_directory = students_node

    students = []
    for student_id, student_node in (student_directory or {}).items():
        if not isinstance(student_node, dict):
            continue

        basic_info = student_node.get("basicStudentInformation") or {}
        status_raw = (
            "inactive"
            if student_node.get("isActive") is False
            else (basic_info.get("status") or student_node.get("status") or "active")
        )

        students.append({
            "studentId": str(student_node.get("studentId") or student_id or "").strip(),
            "userId": str(student_node.get("userId") or "").strip(),
            "name": (
                student_node.get("name")
                or student_node.get("studentName")
                or basic_info.get("name")
                or str(student_id or "")
                or "No Name"
            ),
            "profileImage": (
                student_node.get("profileImage")
                or basic_info.get("studentPhoto")
                or student_node.get("studentPhoto")
                or "/default-profile.png"
            ),
            "grade": student_node.get("grade") or basic_info.get("grade") or "-",
            "section": student_node.get("section") or basic_info.get("section") or "-",
            "gender": str(basic_info.get("gender") or student_node.get("gender") or "").strip().lower(),
            "status": str(status_raw or "active").strip().lower(),
            "createdAt": (
                student_node.get("createdAt")
                or student_node.get("registeredAt")
                or student_node.get("admissionDate")
                or basic_info.get("admissionDate")
            ),
        })

    result = {
        "students": students,
        "parentsCount": len(parents_shallow) if isinstance(parents_shallow, dict) else 0,
        "postsCount": len(posts_shallow) if isinstance(posts_shallow, dict) else 0,
    }
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/academic-years", methods=["GET"])
def get_academic_years():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)
    if not resolved_school_code:
        return jsonify({"academicYears": {}, "currentAcademicYear": "", "schoolCode": ""})

    cache_key = f"academic_years:{resolved_school_code}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    years_node = school_node_ref(resolved_school_code, "AcademicYears").get() or {}
    if not isinstance(years_node, dict):
        years_node = {}

    school_info = school_node_ref(resolved_school_code, "schoolInfo").get() or {}
    if not isinstance(school_info, dict):
        school_info = {}

    current_year = str(school_info.get("currentAcademicYear") or "").strip()
    if not current_year:
        current_year = next(
            (str(year_key) for year_key, row in years_node.items() if isinstance(row, dict) and row.get("isCurrent")),
            "",
        )

    result = {
        "academicYears": years_node,
        "currentAcademicYear": current_year,
        "schoolCode": resolved_school_code,
    }
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/academic-years/history-students", methods=["GET"])
def get_academic_year_history_students():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    year_key = str(request.args.get("yearKey") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)

    if not resolved_school_code:
        return jsonify({"students": []})
    if not year_key:
        return jsonify({"students": []})

    cache_key = f"academic_year_history:{resolved_school_code}:{year_key}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    students_node = school_node_ref(resolved_school_code, f"YearHistory/{year_key}/Students").get() or {}
    users_node = school_node_ref(resolved_school_code, f"YearHistory/{year_key}/SchoolSnapshot/data/Users").get() or {}

    if not isinstance(students_node, dict):
        students_node = {}
    if not isinstance(users_node, dict):
        users_node = {}

    students = []
    for student_id, student_row in students_node.items():
        if not isinstance(student_row, dict):
            continue

        basic_info = student_row.get("basicStudentInformation") or {}
        if not isinstance(basic_info, dict):
            basic_info = {}

        user_id = str(student_row.get("userId") or "").strip()
        user_row = users_node.get(user_id) or {}
        if not isinstance(user_row, dict):
            user_row = {}

        students.append({
            "studentId": str(student_id or "").strip(),
            **student_row,
            "grade": student_row.get("grade") or basic_info.get("grade") or "",
            "section": student_row.get("section") or basic_info.get("section") or "",
            "name": (
                user_row.get("name")
                or student_row.get("name")
                or basic_info.get("name")
                or " ".join(
                    [
                        str(basic_info.get("firstName") or "").strip(),
                        str(basic_info.get("middleName") or "").strip(),
                        str(basic_info.get("lastName") or "").strip(),
                    ]
                ).strip()
                or "Student"
            ),
            "profileImage": (
                user_row.get("profileImage")
                or student_row.get("profileImage")
                or basic_info.get("studentPhoto")
                or "/default-profile.png"
            ),
            "email": user_row.get("email") or student_row.get("email") or basic_info.get("email") or "",
        })

    result = {"students": students}
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/grade-management/grades", methods=["GET"])
def get_grade_management_grades():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)

    if not resolved_school_code:
        return jsonify({"grades": {}})

    cache_key = f"grade_management_grades:{resolved_school_code}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    grades_node = school_node_ref(resolved_school_code, "GradeManagement/grades").get() or {}
    if not isinstance(grades_node, dict):
        grades_node = {}

    result = {"grades": grades_node}
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/directory/teachers", methods=["GET"])
def get_teacher_directory():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)

    if not resolved_school_code:
        return jsonify({"teachers": {}})

    cache_key = f"teacher_directory:{resolved_school_code}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    directory_node = school_node_ref(resolved_school_code, "TeacherDirectory").get() or {}
    if not isinstance(directory_node, dict):
        directory_node = {}

    result = {"teachers": directory_node}
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/directory/students", methods=["GET"])
def get_student_directory():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)

    if not resolved_school_code:
        return jsonify({"students": {}})

    cache_key = f"student_directory:{resolved_school_code}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    directory_node = school_node_ref(resolved_school_code, "StudentDirectory").get() or {}
    if not isinstance(directory_node, dict):
        directory_node = {}

    result = {"students": directory_node}
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/school-node", methods=["PUT"])
def put_school_node_value():
    body = request.get_json(silent=True) or {}
    requested_school_code = str(
        body.get("schoolCode")
        or request.args.get("schoolCode")
        or ""
    ).strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)
    if not resolved_school_code:
        return jsonify({"success": False, "message": "schoolCode is required"}), 400

    raw_path = str(body.get("path") or request.args.get("path") or "").strip()
    normalized_path = unquote(raw_path).strip("/")
    if not normalized_path:
        return jsonify({"success": False, "message": "path is required"}), 400

    value = body.get("value")
    school_node_ref(resolved_school_code, normalized_path).set(value)

    if normalized_path.startswith("GradeManagement/grades"):
        _pc_invalidate(f"grade_management_grades:{resolved_school_code}")
    if normalized_path.startswith("TeacherDirectory"):
        _pc_invalidate(f"teacher_directory:{resolved_school_code}")
    if normalized_path.startswith("StudentDirectory"):
        _pc_invalidate(f"student_directory:{resolved_school_code}")
    if normalized_path.startswith("AcademicYears") or normalized_path.startswith("schoolInfo/currentAcademicYear"):
        _pc_invalidate(f"academic_years:{resolved_school_code}")

    return jsonify({"success": True})


@app.route("/api/school-node-read", methods=["GET"])
def get_school_node_value():
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    resolved_school_code = resolve_school_code_alias(requested_school_code)
    if not resolved_school_code:
        return jsonify({"data": {}})

    raw_path = str(request.args.get("path") or "").strip()
    normalized_path = unquote(raw_path).strip("/")
    if not normalized_path:
        return jsonify({"data": {}})

    cache_key = f"school_node_read:{resolved_school_code}:{normalized_path}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify({"data": cached})

    try:
        data = school_node_ref(resolved_school_code, normalized_path).get()
    except Exception:
        data = {}

    if data is None:
        data = {}
    _pc_set(cache_key, data)
    return jsonify({"data": data})


@app.route("/api/get_all_posts", methods=["GET"])
def get_all_posts():
    def normalize_posts_node(posts_node, school_code=""):
        normalized = {}
        if not isinstance(posts_node, dict):
            return normalized

        if "postId" in posts_node and ("message" in posts_node or "postUrl" in posts_node):
            normalized[str(posts_node.get("postId") or f"{school_code}-legacy-post")] = posts_node
            return normalized

        for raw_key, raw_value in posts_node.items():
            if not isinstance(raw_value, dict):
                continue
            if "postId" not in raw_value and "message" not in raw_value and "postUrl" not in raw_value:
                continue
            normalized[str(raw_value.get("postId") or raw_key)] = raw_value

        return normalized

    all_posts = {}
    schools = all_schools_snapshot()
    for school_code, school in schools.items():
        if isinstance(school, dict) and isinstance(school.get("Posts"), dict):
            all_posts.update(normalize_posts_node(school.get("Posts") or {}, school_code))
    post_list = []

    for key, post in all_posts.items():
        if not isinstance(post, dict):
            continue

        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "time": post.get("time"),
            "likeCount": post.get("likeCount", 0)
        })

    post_list.reverse()
    return jsonify(post_list)



@app.route("/api/mark_post_seen", methods=["POST"])
def mark_post_seen():
    try:
        data = request.get_json(force=True)
        postId = data.get("postId")
        userId = data.get("userId")

        if not postId or not userId:
            return jsonify({"success": False, "message": "Invalid data"}), 400

        resolved = resolve_admin_identifiers(userId)
        if not resolved or not resolved.get("schoolCode"):
            return jsonify({"success": False, "message": "Unknown user school"}), 400

        post_ref = school_node_ref(resolved.get("schoolCode"), "Posts").child(postId)
        post_data = post_ref.get()

        if not post_data:
            return jsonify({"success": False, "message": "Post not found"}), 404

        seen_by = post_data.get("seenBy", {})
        seen_by[userId] = True

        post_ref.update({"seenBy": seen_by})

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500



# ---------------- ADMIN PROFILE ---------------- #
@app.route("/api/admin/<adminId>", methods=["GET"])
def fetch_admin_profile(adminId):
    resolved = resolve_admin_identifiers(adminId)
    if not resolved:
        return jsonify({"success": False, "message": "Admin not found"}), 404

    user_data = resolved.get("user", {})
    if not _is_admin_role(user_data.get("role")):
        return jsonify({"success": False, "message": "Only school_admins accounts can access this profile"}), 403

    profile = {
        "adminId": resolved.get("adminId") or resolved.get("username") or resolved.get("userId"),
        "userId": resolved.get("userId"),
        "schoolCode": resolved.get("schoolCode"),
        "name": user_data.get("name"),
        "username": user_data.get("username"),
        "role": _normalized_role(user_data.get("role")),
        "profileImage": user_data.get("profileImage", "/default-profile.png")
    }
    return jsonify({"success": True, "admin": profile})

# ---------------- GET MY POSTS ---------------- #
@app.route("/api/get_my_posts/<adminId>", methods=["GET"])
def get_my_posts(adminId):
    limit = parse_positive_int(request.args.get("limit"), 200, 1, 500)
    requested_school_code = str(request.args.get("schoolCode") or "").strip()
    requested_user_id = str(request.args.get("userId") or "").strip()

    school_code = ""
    valid_ids = set()

    # Fast path for frontend calls that already know schoolCode and userId.
    if requested_school_code and requested_user_id:
        school_code = resolve_school_code_alias(requested_school_code) or requested_school_code
        valid_ids = {
            str(v).strip()
            for v in [requested_user_id, adminId]
            if str(v).strip()
        }
    else:
        resolved = resolve_admin_identifiers(adminId)
        if not resolved:
            return jsonify([])

        school_code = resolved.get("schoolCode")
        user_id = resolved.get("userId")
        normalized_admin_id = resolved.get("adminId")
        username = resolved.get("username")
        valid_ids = {
            str(v).strip()
            for v in [user_id, normalized_admin_id, username, adminId]
            if str(v).strip()
        }

    if not school_code or not valid_ids:
        return jsonify([])

    cache_key = f"my_posts:{school_code}:{'|'.join(sorted(valid_ids))}:{limit}"
    cached_my_posts = _pc_get(cache_key)
    if cached_my_posts is not None:
        return jsonify(cached_my_posts)

    posts_by_key = {}

    # Bounded indexed reads only; avoid full-node scans that can timeout on large datasets.
    for field_name in ("adminId", "userId"):
        for candidate_id in valid_ids:
            try:
                candidate_posts = (
                    school_node_ref(school_code, "Posts")
                    .order_by_child(field_name)
                    .equal_to(candidate_id)
                    .limit_to_last(limit)
                    .get()
                    or {}
                )
                if isinstance(candidate_posts, dict):
                    posts_by_key.update(candidate_posts)
            except Exception:
                pass

    if not posts_by_key:
        # Some datasets may not support efficient child-index queries reliably.
        # Fall back to a bounded recent-post window instead of a full-node scan.
        recent_limit = max(200, min(500, limit * 4))
        recent_posts = read_recent_posts_for_school(school_code, recent_limit)
        if isinstance(recent_posts, dict):
            posts_by_key.update(recent_posts)

    if not posts_by_key:
        _pc_set(cache_key, [])
        return jsonify([])

    my_posts = []

    # Filter posts by any known equivalent ID
    for key, post in posts_by_key.items():
        if not isinstance(post, dict):
            continue
        post_admin_id = str(post.get("adminId") or "")
        if post_admin_id and post_admin_id in valid_ids:
            my_posts.append({
                "postId": key,
                "message": post.get("message") or post.get("content") or "",
                "postUrl": post.get("postUrl") or post.get("mediaUrl") or None,
                "time": post.get("time") or post.get("createdAt") or datetime.utcnow().isoformat(),
                "edited": post.get("edited", False),
                "likeCount": post.get("likeCount", 0),
                "likes": post.get("likes", {}),
                "adminId": post_admin_id
            })

    # Sort posts by time descending
    def parse_time(t):
        try:
            return datetime.fromisoformat(t)
        except:
            # Fallback for old time formats
            try:
                return datetime.strptime(t, "%I:%M %p, %b %d %Y")
            except:
                return datetime.min

    my_posts.sort(key=lambda x: parse_time(x["time"]), reverse=True)
    my_posts = my_posts[:limit]

    _pc_set(cache_key, my_posts)

    return jsonify(my_posts)

# ---------------- GET POST NOTIFICATIONS ---------------- #
@app.route("/api/get_post_notifications/<adminId>", methods=["GET"])
def get_post_notifications(adminId):
    try:
        limit = parse_positive_int(request.args.get("limit"), 25, 1, 50)
        resolved_viewer = resolve_admin_identifiers(adminId)
        if not resolved_viewer:
            return jsonify([])

        viewer_user_id = resolved_viewer.get("userId")
        school_code = resolved_viewer.get("schoolCode")
        cache_key = f"post_notifications:{school_code}:{viewer_user_id}:{limit}"
        cached = _pc_get(cache_key)
        if cached is not None:
            return jsonify(cached)

        all_posts = read_recent_posts_for_school(school_code, max(limit * 3, 30))
        if not isinstance(all_posts, dict):
            all_posts = {}

        actor_profiles = load_post_actor_profiles(school_code, list(all_posts.values()))
        notifications = []

        for key, post in all_posts.items():
            if not isinstance(post, dict):
                continue
            seen_by = post.get("seenBy", {})
            # Only include posts the admin has NOT seen
            if not seen_by.get(viewer_user_id):
                actor_id = str(post.get("adminId") or post.get("userId") or "").strip()
                user_data = actor_profiles.get(actor_id, {}) if actor_id else {}
                notifications.append({
                    "postId": key,
                    "message": post.get("message"),
                    "postUrl": post.get("postUrl"),
                    "adminId": post.get("adminId"),
                    "adminName": user_data.get("name", "Admin"),  # Admin name
                    "adminProfile": user_data.get("profileImage", "/default-profile.png"),  # Admin profile image
                    "time": post.get("time"),
                })

        # Sort newest first
        notifications.sort(key=lambda x: str(x.get("time") or ""), reverse=True)
        notifications = notifications[:limit]
        _pc_set(cache_key, notifications)
        return jsonify(notifications)
    
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/mark_post_notification_read", methods=["POST"])
def mark_post_notification_read():
    data = request.get_json(silent=True) or {}
    admin_id = str(data.get("adminId") or data.get("userId") or "").strip()
    post_id = str(data.get("postId") or data.get("notificationId") or "").strip()
    requested_school_code = str(data.get("schoolCode") or "").strip()

    if not admin_id or not post_id:
        return jsonify({"success": False, "message": "adminId and postId are required"}), 400

    resolved_viewer = resolve_admin_identifiers(admin_id)
    viewer_user_id = str((resolved_viewer or {}).get("userId") or admin_id).strip()
    school_code = str((resolved_viewer or {}).get("schoolCode") or requested_school_code).strip()
    school_code = resolve_school_code_alias(school_code)
    if not school_code:
        return jsonify({"success": False, "message": "Unable to resolve school"}), 400

    school_node_ref(school_code, f"Posts/{post_id}/seenBy/{viewer_user_id}").set(True)

    _pc_invalidate_prefix(f"post_notifications:{school_code}:{viewer_user_id}:")
    _pc_invalidate(f"posts:{school_code}:60")

    return jsonify({"success": True}), 200


# ---------------- EDIT POST ---------------- #
@app.route("/api/edit_post/<postId>", methods=["POST"])
def edit_post(postId):
    postId = str(postId)  # ✅ Firebase keys are strings

    data = request.get_json(silent=True) or {}

    adminId = data.get("adminId")
    new_text = data.get("postText") or data.get("message")

    if not adminId:
        return jsonify({"success": False, "message": "adminId missing"}), 400

    if not new_text:
        return jsonify({"success": False, "message": "Empty message"}), 400

    requester = resolve_admin_identifiers(adminId)
    if not requester:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    school_code = requester.get("schoolCode")
    post_ref = school_node_ref(school_code, "Posts").child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404

    post_owner = resolve_admin_identifiers(post_data.get("adminId"))
    if not post_owner or str(post_owner.get("userId")) != str(requester.get("userId")):
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    post_ref.update({
        "message": new_text,
        "updatedAt": datetime.now().strftime("%I:%M %p, %b %d %Y"),
        "edited": True
    })
    _pc_invalidate(f"posts:{school_code}:60")
    _pc_invalidate_prefix(f"my_posts:{school_code}:")
    return jsonify({"success": True, "message": "Post updated"})


# ---------------- DELETE POST ---------------- #
@app.route("/api/delete_post/<postId>", methods=["DELETE"])
def delete_post(postId):
    postId = str(postId)  # ✅ Firebase key

    # ✅ READ FROM QUERY PARAMS
    adminId = request.args.get("adminId")

    if not adminId:
        return jsonify({"success": False, 
                         
                         "message": "adminId missing"}), 400

    requester = resolve_admin_identifiers(adminId)
    if not requester:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    school_code = requester.get("schoolCode")
    post_ref = school_node_ref(school_code, "Posts").child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404

    post_owner = resolve_admin_identifiers(post_data.get("adminId"))
    if not post_owner or str(post_owner.get("userId")) != str(requester.get("userId")):
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    post_ref.delete()
    _pc_invalidate(f"posts:{school_code}:60")
    _pc_invalidate_prefix(f"my_posts:{school_code}:")
    return jsonify({"success": True, "message": "Post deleted"})


# ---------------- LIKE POST ---------------- #
@app.route("/api/like_post", methods=["POST"])
def like_post():
    try:
        data = request.get_json(force=True)
        postId = data.get("postId")
        adminId = data.get("adminId")
        if not postId or not adminId:
            return jsonify({"success": False, "message": "Invalid data"})

        resolved = resolve_admin_identifiers(adminId)
        if not resolved:
            return jsonify({"success": False, "message": "Unknown admin identity"}), 400

        liker_user_id = resolved.get("userId")
        school_code = resolved.get("schoolCode")

        post_ref = school_node_ref(school_code, "Posts").child(postId)
        likes_ref = post_ref.child("likes")
        current_like = likes_ref.child(liker_user_id).get()

        if current_like:
            likes_ref.child(liker_user_id).delete()
        else:
            likes_ref.child(liker_user_id).set(True)

        likes = likes_ref.get() or {}
        post_ref.update({"likeCount": len(likes)})

        return jsonify({"success": True, "likeCount": len(likes), "liked": not current_like})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---------------- CHAT ENDPOINTS ---------------- #

# Send a message
@app.route("/api/send_message", methods=["POST"])
def send_message():
    try:
        data = request.get_json(force=True)
        senderId = data.get("senderId")
        receiverId = data.get("receiverId")
        message = data.get("message")

        if not senderId or not receiverId or not message:
            return jsonify({"success": False, "message": "Invalid data"}), 400

        sender_resolved = resolve_admin_identifiers(senderId)
        if not sender_resolved or not sender_resolved.get("schoolCode"):
            return jsonify({"success": False, "message": "Sender school not found"}), 400

        msg_ref = school_node_ref(sender_resolved.get("schoolCode"), "Chats").push()
        msg_ref.set({
            "messageId": msg_ref.key,
            "senderId": senderId,
            "receiverId": receiverId,
            "message": message,
            "time": datetime.now().isoformat(),
            "read": False
        })
        _pc_invalidate(f"unread_messages:{sender_resolved.get('schoolCode')}:{receiverId}")
        return jsonify({"success": True, "message": "Message sent"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# Get chat between two users
@app.route("/api/chat/<adminId>/<userId>", methods=["GET"])
def get_chat(adminId, userId):
    resolved = resolve_admin_identifiers(adminId)
    if not resolved or not resolved.get("schoolCode"):
        return jsonify([])

    all_msgs = school_node_ref(resolved.get("schoolCode"), "Chats").get() or {}
    chat = [msg for key, msg in all_msgs.items()
            if (msg.get("senderId") in [adminId, userId]) and
               (msg.get("receiverId") in [adminId, userId])]
    chat_sorted = sorted(chat, key=lambda x: x['time'])
    return jsonify(chat_sorted)

# Mark messages as read
@app.route("/api/mark_messages_read", methods=["POST"])
def mark_messages_read():
    data = request.get_json(force=True)
    adminId = data.get("adminId")
    senderId = data.get("senderId")
    resolved = resolve_admin_identifiers(adminId)
    if not resolved or not resolved.get("schoolCode"):
        return jsonify({"success": False, "message": "Unknown admin school"}), 400

    chats_ref = school_node_ref(resolved.get("schoolCode"), "Chats")
    all_msgs = chats_ref.get() or {}

    for key, msg in all_msgs.items():
        if msg.get("receiverId") == adminId and msg.get("senderId") == senderId:
            chats_ref.child(key).update({"read": True})

    _pc_invalidate(f"unread_messages:{resolved.get('schoolCode')}:{adminId}")
    return jsonify({"success": True})

# Get unread messages for admin
@app.route("/api/unread_messages/<adminId>", methods=["GET"])
def get_unread_messages(adminId):
    resolved = resolve_admin_identifiers(adminId)
    if not resolved or not resolved.get("schoolCode"):
        return jsonify({"count": 0, "messages": []})

    school_code = str(resolved.get("schoolCode") or "").strip()
    viewer_user_id = str(resolved.get("userId") or adminId).strip()
    cache_key = f"unread_messages:{school_code}:{viewer_user_id}"
    cached = _pc_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    # Fast path: consume per-user chat summaries instead of scanning full Chats node.
    summaries = school_node_ref(school_code, f"Chat_Summaries/{viewer_user_id}").get() or {}
    unread_msgs = []

    if isinstance(summaries, dict) and summaries:
        for chat_id, summary_value in summaries.items():
            if not isinstance(summary_value, dict):
                continue

            other_user_id = str(summary_value.get("otherUserId") or "").strip()
            unread_count = int(summary_value.get("unreadCount") or 0)
            if unread_count <= 0 or not other_user_id:
                continue

            # Preserve existing response shape used by frontend (array of message-like objects).
            unread_msgs.extend(
                {
                    "senderId": other_user_id,
                    "receiverId": viewer_user_id,
                    "read": False,
                    "chatId": str(chat_id),
                }
                for _ in range(unread_count)
            )

    result = {"count": len(unread_msgs), "messages": unread_msgs}
    _pc_set(cache_key, result)
    return jsonify(result)


@app.route("/api/users_lookup", methods=["GET"])
def users_lookup():
    raw_user_ids = str(request.args.get("userIds") or "").strip()
    school_code = str(request.args.get("schoolCode") or "").strip()
    user_ids = [str(v).strip() for v in raw_user_ids.split(",") if str(v).strip()]

    if not user_ids:
        return jsonify({"users": {}})

    if not school_code:
        for candidate_user_id in user_ids:
            resolved = resolve_admin_identifiers(candidate_user_id)
            if resolved and resolved.get("schoolCode"):
                school_code = str(resolved.get("schoolCode") or "").strip()
                break

    school_code = resolve_school_code_alias(school_code)
    if not school_code:
        return jsonify({"users": {}})

    users = {}
    for user_id in user_ids:
        user_data = school_node_ref(school_code, f"Users/{user_id}").get() or {}
        if not isinstance(user_data, dict):
            user_data = {}

        users[user_id] = {
            "userId": str(user_data.get("userId") or user_id),
            "name": user_data.get("name") or user_data.get("username") or user_id,
            "username": user_data.get("username") or "",
            "profileImage": user_data.get("profileImage") or "/default-profile.png",
            "role": user_data.get("role") or user_data.get("userType") or "",
        }

    return jsonify({"users": users})


@app.route("/api/calendar_events", methods=["GET", "POST"])
def calendar_events():
    if request.method == "GET":
        school_code = str(request.args.get("schoolCode") or "").strip()
        school_code = resolve_school_code_alias(school_code)
        if not school_code:
            return jsonify([])

        events_node = school_node_ref(school_code, "CalendarEvents").get() or {}
        if not isinstance(events_node, dict):
            events_node = {}

        events = []
        for event_id, event_value in events_node.items():
            if isinstance(event_value, dict):
                events.append({"id": str(event_id), **event_value})

        return jsonify(events)

    payload = request.get_json(force=True) or {}
    school_code = str(payload.get("schoolCode") or request.args.get("schoolCode") or "").strip()
    school_code = resolve_school_code_alias(school_code)
    if not school_code:
        return jsonify({"success": False, "message": "schoolCode is required"}), 400

    event_payload = dict(payload)
    event_payload.pop("schoolCode", None)

    event_ref = school_node_ref(school_code, "CalendarEvents").push()
    event_ref.set(event_payload)
    return jsonify({"success": True, "id": event_ref.key})


@app.route("/api/calendar_events/<eventId>", methods=["PATCH", "DELETE"])
def calendar_event_item(eventId):
    body = request.get_json(silent=True) or {}
    school_code = str(
        request.args.get("schoolCode")
        or body.get("schoolCode")
        or ""
    ).strip()
    school_code = resolve_school_code_alias(school_code)

    if not school_code:
        return jsonify({"success": False, "message": "schoolCode is required"}), 400

    event_ref = school_node_ref(school_code, f"CalendarEvents/{eventId}")

    if request.method == "DELETE":
        event_ref.delete()
        return jsonify({"success": True})

    patch_payload = dict(body)
    patch_payload.pop("schoolCode", None)
    if not patch_payload:
        return jsonify({"success": False, "message": "No update payload provided"}), 400

    event_ref.update(patch_payload)
    return jsonify({"success": True})





# ---------------- RUN ---------------- #
if __name__ == "__main__":
    debug_enabled = APP_ENV != "production" and str(os.getenv("FLASK_DEBUG") or "").strip().lower() not in ("0", "false", "no")
    run_host = str(os.getenv("FLASK_RUN_HOST") or "127.0.0.1").strip()
    run_port = int(os.getenv("FLASK_RUN_PORT") or 5001)
    app.run(host=run_host, port=run_port, debug=debug_enabled)
