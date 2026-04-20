from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import os
import sys
from datetime import datetime
from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials


app = Flask(__name__)
CORS(app)

# Path to your Firebase service account JSON (managed centrally via serviceAccountKey.py)
firebase_json = require_firebase_credentials()
if not os.path.exists(firebase_json):
    print(f"Firebase JSON missing at {firebase_json}")
    sys.exit(1)

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, get_firebase_options())

PLATFORM_SCHOOLS_REF = "Platform1/Schools"


def schools_data():
    return db.reference(PLATFORM_SCHOOLS_REF).get() or {}


def school_ref(school_code):
    return db.reference(f"{PLATFORM_SCHOOLS_REF}/{school_code}")


def find_school_code_for_user(user_id=None, finance_id=None):
    all_schools = schools_data()
    for school_code, school_node in all_schools.items():
        school_node = school_node or {}

        finance_map = school_node.get("Finance") or {}
        if finance_id and finance_map.get(finance_id):
            return school_code

        if user_id:
            users_map = school_node.get("Users") or {}
            if users_map.get(user_id):
                return school_code

            for _, f in finance_map.items():
                if (f or {}).get("userId") == user_id:
                    return school_code

    return None


def generate_parent_id(school_code):
    parents = school_ref(school_code).child("Parents").get() or {}
    year_suffix = datetime.utcnow().strftime("%y")
    prefix = "GPR"
    max_seq = 0

    for pid in parents.keys():
        text = str(pid or "")
        parts = text.split("_")
        if len(parts) == 3 and parts[0] == prefix and parts[2] == year_suffix:
            try:
                seq = int(parts[1])
                if seq > max_seq:
                    max_seq = seq
            except Exception:
                continue

    next_seq = max_seq + 1
    return f"{prefix}_{str(next_seq).zfill(4)}_{year_suffix}"


@app.route("/register/parent", methods=["POST"])
@app.route("/api/register/parent", methods=["POST"])
def register_parent():
    try:
        name = (request.form.get("name") or "").strip()
        username = (request.form.get("username") or "").strip()
        phone = (request.form.get("phone") or "").strip()
        password = request.form.get("password") or ""
        school_code = (request.form.get("schoolCode") or request.args.get("schoolCode") or "").strip()

        student_ids = [str(s).strip() for s in request.form.getlist("studentId") if str(s).strip()]
        relationships = [str(r).strip() for r in request.form.getlist("relationship") if str(r).strip()]

        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        if not name or not username or not phone or not password:
            return jsonify({"success": False, "message": "Name, username, phone and password are required."}), 400

        if len(student_ids) == 0:
            return jsonify({"success": False, "message": "Add at least one child."}), 400

        if len(student_ids) != len(relationships):
            return jsonify({"success": False, "message": "Each child must include relationship."}), 400

        users_ref = school_ref(school_code).child("Users")
        parents_ref = school_ref(school_code).child("Parents")
        students_ref = school_ref(school_code).child("Students")

        users = users_ref.get() or {}
        for uid, u in users.items():
            row = u or {}
            if str(row.get("username") or "").lower() == username.lower():
                return jsonify({"success": False, "message": "Username already exists."}), 400
            existing_phone = str(row.get("phone") or row.get("Phone") or row.get("phoneNumber") or "").strip()
            if existing_phone and existing_phone == phone:
                return jsonify({"success": False, "message": "Phone already exists."}), 400

        students_data = students_ref.get() or {}
        for sid in student_ids:
            if sid not in students_data:
                return jsonify({"success": False, "message": f"Student not found: {sid}"}), 400

        profile_url = "/default-profile.png"

        new_user_ref = users_ref.push()
        user_id = new_user_ref.key
        parent_id = generate_parent_id(school_code)

        user_payload = {
            "userId": user_id,
            "name": name,
            "username": username,
            "phone": phone,
            "password": password,
            "profileImage": profile_url,
            "role": "parent",
            "isActive": True,
            "schoolCode": school_code,
        }
        new_user_ref.set(user_payload)

        children_payload = {}
        for idx, sid in enumerate(student_ids):
            rel = relationships[idx]
            children_payload[f"child_{idx + 1}"] = {
                "studentId": sid,
                "relationship": rel,
                "createdAt": datetime.utcnow().isoformat(),
            }

        parent_payload = {
            "parentId": parent_id,
            "userId": user_id,
            "phone": phone,
            "children": children_payload,
            "status": "active",
            "createdAt": datetime.utcnow().isoformat(),
            "schoolCode": school_code,
        }
        parents_ref.child(parent_id).set(parent_payload)

        for idx, sid in enumerate(student_ids):
            rel = relationships[idx]
            students_ref.child(f"{sid}/parents/{parent_id}").set({
                "relationship": rel,
                "userId": user_id,
                "parentId": parent_id,
                "linkedAt": datetime.utcnow().isoformat(),
            })

        return jsonify({"success": True, "message": "Parent registered successfully", "parentId": parent_id, "userId": user_id}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/login", methods=["POST"])
def login_finance():
    try:
        data = request.get_json(force=True)
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"success": False, "message": "Missing credentials"}), 400

        all_schools = schools_data()
        matched_user = None
        matched_school_code = None

        for school_code, school_node in all_schools.items():
            users = (school_node or {}).get("Users") or {}
            for uid, u in users.items():
                if u.get("username") == username and u.get("password") == password:
                    matched_user = {"userId": uid, **(u or {})}
                    matched_school_code = school_code
                    break
            if matched_user:
                break

        if not matched_user:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401

        # Ensure the user has finance role
        if matched_user.get("role") != "finance":
            return jsonify({"success": False, "message": "User is not finance"}), 403

        # Find finance record by userId
        all_finances = ((all_schools.get(matched_school_code) or {}).get("Finance") or {})
        finance_record = None
        for fid, f in all_finances.items():
            if f.get("userId") == matched_user["userId"]:
                finance_record = {"financeId": fid, **(f or {})}
                break

        resp = {
            "success": True,
            "message": "Login success",
            "user": {
                "userId": matched_user.get("userId"),
                "username": matched_user.get("username"),
                "name": matched_user.get("name"),
                "profileImage": matched_user.get("profileImage", ""),
                "role": matched_user.get("role"),
                "employeeId": matched_user.get("employeeId"),
                "phone": matched_user.get("Phone") or matched_user.get("phone")
            },
            "finance": finance_record or {}
        }

        resp["schoolCode"] = matched_school_code

        return jsonify(resp)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        # Accept form-data from frontend. File uploads handled client-side to Firebase Storage.
        message = request.form.get("message") or ""
        postUrl = request.form.get("postUrl") or ""
        adminId = request.form.get("adminId") or ""
        adminName = request.form.get("adminName") or ""
        adminProfile = request.form.get("adminProfile") or ""
        financeId = request.form.get("financeId") or ""
        financeName = request.form.get("financeName") or ""
        financeProfile = request.form.get("financeProfile") or ""
        userId = request.form.get("userId") or ""
        schoolCode = request.form.get("schoolCode") or request.args.get("schoolCode") or ""

        if not schoolCode:
            schoolCode = find_school_code_for_user(user_id=userId, finance_id=financeId or adminId)

        if not schoolCode:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        post_obj = {
            # prefer financeId as the owner identifier (replace adminId)
            "financeId": financeId or adminId,
            "adminId": adminId or financeId,
            "userId": userId,
            "adminName": adminName or financeName,
            "adminProfile": adminProfile or financeProfile,
            "postUrl": postUrl,
            "message": message,
            "likeCount": 0,
            "likes": {},
            "seenBy": {},
            "time": datetime.utcnow().isoformat()
        }

        # mark as seen by owner (finance/admin) if available
        owner_key = post_obj.get("financeId")
        if owner_key:
            post_obj["seenBy"][owner_key] = True

        posts_ref = school_ref(schoolCode).child("Posts")
        new_ref = posts_ref.push(post_obj)
        post_id = new_ref.key
        # ensure postId field exists
        school_ref(schoolCode).child(f"Posts/{post_id}").update({"postId": post_id, "schoolCode": schoolCode})

        # return created post
        created = school_ref(schoolCode).child(f"Posts/{post_id}").get() or {}
        created["postId"] = post_id
        created["schoolCode"] = schoolCode

        return jsonify({"success": True, "post": created}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    try:
        school_code = request.args.get("schoolCode")
        result = []

        def collect_posts(posts_node, source_school_code):
            if isinstance(posts_node, dict):
                for key, val in posts_node.items():
                    item = val or {}
                    item["postId"] = item.get("postId") or key
                    item["schoolCode"] = item.get("schoolCode") or source_school_code
                    result.append(item)

        if school_code:
            posts = school_ref(school_code).child("Posts").get() or {}
            collect_posts(posts, school_code)
        else:
            all_schools = schools_data()
            for code, school_node in all_schools.items():
                posts = (school_node or {}).get("Posts") or {}
                collect_posts(posts, code)

        # sort by time if present (ISO strings sort lexicographically)
        try:
            result.sort(key=lambda x: x.get("time") or x.get("createdAt") or "", reverse=True)
        except Exception:
            pass

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/get_my_posts/<owner_id>", methods=["GET"])
def get_my_posts(owner_id):
    try:
        school_code = request.args.get("schoolCode")
        result = []

        def collect_my_posts(posts_node, source_school_code):
            if isinstance(posts_node, dict):
                for key, val in posts_node.items():
                    item = val or {}
                    item["postId"] = item.get("postId") or key
                    item["schoolCode"] = item.get("schoolCode") or source_school_code
                    if (
                        str(item.get("financeId") or "") == str(owner_id)
                        or str(item.get("userId") or "") == str(owner_id)
                        or str(item.get("adminId") or "") == str(owner_id)
                    ):
                        result.append(item)

        if school_code:
            posts = school_ref(school_code).child("Posts").get() or {}
            collect_my_posts(posts, school_code)
        else:
            all_schools = schools_data()
            for code, school_node in all_schools.items():
                posts = (school_node or {}).get("Posts") or {}
                collect_my_posts(posts, code)

        try:
            result.sort(key=lambda x: x.get("time") or x.get("createdAt") or "", reverse=True)
        except Exception:
            pass

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/get_students", methods=["GET"])
def get_students():
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        students = school_ref(school_code).child("Students").get() or {}
        result = []
        if isinstance(students, dict):
            for key, val in students.items():
                item = val or {}
                item["studentId"] = key
                result.append(item)

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
