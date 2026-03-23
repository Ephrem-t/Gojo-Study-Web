from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import sys
import re




app = Flask(__name__)
CORS(app)

# ---------------- FIREBASE ---------------- #
firebase_json = "bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json"
if not os.path.exists(firebase_json):
    print("Firebase JSON missing")
    sys.exit()

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://bale-house-rental-default-rtdb.firebaseio.com/",
    "storageBucket": "bale-house-rental.appspot.com"
})
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


def _merged_dict(*nodes):
    merged = {}
    for node in nodes:
        if isinstance(node, dict):
            merged.update(node)
    return merged


def get_users_snapshot():
    """Read users from all schools under Platform1/Schools/*/Users."""
    users = {}
    schools = all_schools_snapshot()
    for school in schools.values():
        if not isinstance(school, dict):
            continue
        school_users = school.get("Users") or {}
        if isinstance(school_users, dict):
            users.update(school_users)
    return users


def get_users_snapshot_for_school(school_code):
    return school_node_ref(school_code, "Users").get() or {}


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

    schools_node = all_schools_snapshot()
    if isinstance(schools_node, dict):
        for key, school in schools_node.items():
            if not isinstance(school, dict):
                continue
            school_info = school.get("schoolInfo") or {}
            options.append({
                "code": key,
                "shortName": school_info.get("shortName") or school_info.get("short_name") or "SCH",
                "name": school_info.get("name") or school.get("schoolName") or key,
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




@app.route("/api/register", methods=["POST"])
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
        adminId = data.get("adminId")  # This is userId from frontend
        media_file = request.files.get("post_media")

        if not adminId:
            return jsonify({"success": False, "message": "Admin not logged in"})

        resolved = resolve_admin_identifiers(adminId)
        if not resolved:
            return jsonify({"success": False, "message": "Unknown admin identity"}), 400

        post_url = ""
        if media_file:
            post_url = upload_file_to_firebase(media_file, folder="posts")

        school_code = resolved.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "Admin school not found"}), 400

        post_ref = school_node_ref(school_code, "Posts").push()
        time_now = datetime.utcnow().isoformat()
        
        admin_user_id = resolved.get("userId")
        
        post_ref.set({
            "postId": post_ref.key,
            "message": text,
            "postUrl": post_url,
            "adminId": admin_user_id,
            "time": time_now,
            "likeCount": 0,
            "likes": {},
            "seenBy": {
                admin_user_id: True
            }
        })

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

    all_posts = {}
    requested_school_code = (request.args.get("schoolCode") or "").strip()

    if requested_school_code:
        school = (all_schools_snapshot() or {}).get(requested_school_code) or {}
        if isinstance(school, dict) and isinstance(school.get("Posts"), dict):
            all_posts.update(normalize_posts_node(school.get("Posts") or {}, requested_school_code))
    else:
        schools = all_schools_snapshot()
        for school_code, school in schools.items():
            if isinstance(school, dict) and isinstance(school.get("Posts"), dict):
                all_posts.update(normalize_posts_node(school.get("Posts") or {}, school_code))

    post_list = []

    for key, post in all_posts.items():
        if not isinstance(post, dict):
            continue

        post_owner = resolve_admin_identifiers(post.get("adminId"))
        user_data = post_owner.get("user", {}) if post_owner else {}
        
        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "userId": post.get("userId"),
            "targetRole": post.get("targetRole", "all"),
            "schoolCode": post.get("schoolCode", requested_school_code),
            "adminName": user_data.get("name", "Admin"),
            "adminProfile": user_data.get("profileImage", "/default-profile.png"),
            "time": post.get("time"),
            "likes": post.get("likes", {}),
            "likeCount": post.get("likeCount", 0),
            "seenBy": post.get("seenBy", {})   # 🔥 THIS LINE
        })



    post_list.reverse()
    return jsonify(post_list)


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
    resolved = resolve_admin_identifiers(adminId)
    if not resolved:
        return jsonify([])

    school_code = resolved.get("schoolCode")
    all_posts = school_node_ref(school_code, "Posts").get() or {}
    my_posts = []

    user_id = resolved.get("userId")
    normalized_admin_id = resolved.get("adminId")
    username = resolved.get("username")

    # Filter posts by any known equivalent ID
    for key, post in all_posts.items():
        post_admin_id = str(post.get("adminId") or "")
        valid_ids = {str(user_id), str(normalized_admin_id), str(username), str(adminId)}
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

    return jsonify(my_posts)

# ---------------- GET POST NOTIFICATIONS ---------------- #
@app.route("/api/get_post_notifications/<adminId>", methods=["GET"])
def get_post_notifications(adminId):
    try:
        resolved_viewer = resolve_admin_identifiers(adminId)
        if not resolved_viewer:
            return jsonify([])

        viewer_user_id = resolved_viewer.get("userId")
        school_code = resolved_viewer.get("schoolCode")
        all_posts = school_node_ref(school_code, "Posts").get() or {}
        notifications = []

        for key, post in all_posts.items():
            seen_by = post.get("seenBy", {})
            # Only include posts the admin has NOT seen
            if not seen_by.get(viewer_user_id):
                # Fetch the admin/user who created this post
                owner = resolve_admin_identifiers(post.get("adminId"))
                user_data = owner.get("user", {}) if owner else {}
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
        notifications.sort(key=lambda x: x['time'], reverse=True)
        return jsonify(notifications)
    
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/mark_post_notification_read", methods=["POST"])
def mark_post_notification_read():
    data = request.get_json()
    notification_id = data.get("notificationId")
    
    # your logic here...
    
    return jsonify({"success": True}), 200  # 🔹 must return 200


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

    return jsonify({"success": True})

# Get unread messages for admin
@app.route("/api/unread_messages/<adminId>", methods=["GET"])
def get_unread_messages(adminId):
    resolved = resolve_admin_identifiers(adminId)
    if not resolved or not resolved.get("schoolCode"):
        return jsonify({"count": 0, "messages": []})

    chats_ref = school_node_ref(resolved.get("schoolCode"), "Chats")
    all_msgs = chats_ref.get() or {}
    unread_msgs = [msg for key, msg in all_msgs.items()
                   if msg.get("receiverId") == adminId and not msg.get("read", False)]
    return jsonify({"count": len(unread_msgs), "messages": unread_msgs})





# ---------------- RUN ---------------- #
if __name__ == "__main__":
    app.run(debug=True)
