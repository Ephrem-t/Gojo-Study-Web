from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
import sys
import json
import uuid
import time
import threading
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
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
bucket = storage.bucket()

PLATFORM_SCHOOLS_REF = "Platform1/Schools"
ROLLOVER_ALLOWED_DELAYS = {3600, 21600, 43200, 86400}

# ---------------------------------------------------------------------------
# Server-side node cache — shared across ALL registerers hitting this server.
# With 100 registerers each re-downloading 10 MB every 30 min, this reduces
# 100 RTDB reads → 1 RTDB read per cache window per node per school.
# ---------------------------------------------------------------------------
_NODE_CACHE: dict = {}           # key → {"data": ..., "ts": float}
_NODE_CACHE_LOCK = threading.Lock()
NODE_CACHE_TTL = 30 * 60        # 30 minutes (seconds)


def _cache_key(school_code: str, node: str) -> str:
    return f"{school_code}:{node}"


def _get_cached_node(school_code: str, node: str):
    key = _cache_key(school_code, node)
    with _NODE_CACHE_LOCK:
        entry = _NODE_CACHE.get(key)
        if entry and (time.monotonic() - entry["ts"]) < NODE_CACHE_TTL:
            return entry["data"], True          # (data, cache_hit)
    return None, False


def _set_cached_node(school_code: str, node: str, data) -> None:
    key = _cache_key(school_code, node)
    with _NODE_CACHE_LOCK:
        _NODE_CACHE[key] = {"data": data, "ts": time.monotonic()}


def _invalidate_cached_node(school_code: str, node: str) -> None:
    """Call after write mutations so the next read fetches fresh data."""
    key = _cache_key(school_code, node)
    with _NODE_CACHE_LOCK:
        _NODE_CACHE.pop(key, None)


def get_school_node_cached(school_code: str, node: str):
    """Fetch a school sub-node, returning the cached copy when fresh."""
    data, hit = _get_cached_node(school_code, node)
    if hit:
        return data
    data = school_ref(school_code).child(node).get() or {}
    _set_cached_node(school_code, node, data)
    return data


def schools_data():
    return db.reference(PLATFORM_SCHOOLS_REF).get() or {}


def school_ref(school_code):
    return db.reference(f"{PLATFORM_SCHOOLS_REF}/{school_code}")


def upload_file_to_firebase(file, folder=""):
    try:
        filename = secure_filename(file.filename or "")
        if not filename:
            filename = f"upload_{uuid.uuid4().hex}"

        object_name = f"{uuid.uuid4().hex}_{filename}"
        normalized_folder = str(folder or "").strip().strip("/")
        if normalized_folder:
            object_name = f"{normalized_folder}/{object_name}"

        blob = bucket.blob(object_name)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    except Exception as exc:
        print("Upload Error:", exc)
        return ""


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
    # Use shallow=True to download only keys (~50 KB) instead of full node data (~10 MB)
    parents = school_ref(school_code).child("Parents").get(shallow=True) or {}
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


def generate_scoped_id(school_code, node_name, prefix):
    # Use shallow=True to download only keys (~50 KB) instead of full node data (~10 MB)
    node = school_ref(school_code).child(node_name).get(shallow=True) or {}
    year_suffix = datetime.utcnow().strftime("%y")
    max_seq = 0

    if isinstance(node, dict):
        for key in node.keys():
            text = str(key or "")
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


def generate_temp_password(length=8):
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    value = ""
    for _ in range(length):
        value += chars[int.from_bytes(os.urandom(1), "big") % len(chars)]
    return value


def normalize_year_key(value):
    text = str(value or "").strip()
    if not text:
        return ""

    if "/" in text:
        parts = text.split("/")
    elif "_" in text:
        parts = text.split("_")
    else:
        parts = [text]

    if len(parts) == 2:
        try:
            start = int(parts[0])
            end = int(parts[1])
            if end == start + 1:
                return f"{start}_{end}"
        except Exception:
            return ""

    if len(parts) == 1:
        try:
            start = int(parts[0])
            return f"{start}_{start + 1}"
        except Exception:
            return ""

    return ""


def year_label_from_key(year_key):
    normalized = normalize_year_key(year_key)
    if not normalized:
        return ""
    start, end = normalized.split("_")
    return f"{start}/{end}"


def get_school_code_from_request():
    json_body = request.get_json(silent=True) or {}
    return (
        request.form.get("schoolCode")
        or request.args.get("schoolCode")
        or json_body.get("schoolCode")
        or ""
    ).strip()


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso_datetime(value):
    text = str(value or "").strip()
    if not text:
        return None

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def generate_request_id(prefix="rollover"):
    return f"{prefix}_{int(datetime.utcnow().timestamp())}_{os.urandom(3).hex()}"


def rollover_control_ref(school_code):
    return school_ref(school_code).child("RolloverControl")


def pending_rollover_ref(school_code):
    return rollover_control_ref(school_code).child("Pending")


def rollover_history_ref(school_code):
    return rollover_control_ref(school_code).child("History")


def clone_payload(value):
    return json.loads(json.dumps(value))


def get_registerer_user(school_code, actor_user_id):
    if not school_code or not actor_user_id:
        return None

    user = school_ref(school_code).child("Users").child(actor_user_id).get() or {}
    role = str(user.get("role") or "").strip().lower().replace("_", " ").replace("-", " ")
    username = str(user.get("username") or "").strip().upper()

    if role != "registerer" or not username.startswith("GSR_"):
        return None

    return {"userId": actor_user_id, **user}


def verify_registerer_password(school_code, actor_user_id, password):
    user = get_registerer_user(school_code, actor_user_id)
    if not user:
        return None

    if str(user.get("password") or "") != str(password or ""):
        return None

    return user


def get_current_academic_year(school_node):
    school_info = (school_node or {}).get("schoolInfo") or {}
    current_year = normalize_year_key(school_info.get("currentAcademicYear"))
    if current_year:
        return current_year

    years = (school_node or {}).get("AcademicYears") or {}
    for year_key, row in years.items():
        if (row or {}).get("isCurrent"):
            return normalize_year_key(year_key)

    return ""


def build_rollover_guard_preview(school_node, current_year, target_year):
    students = (school_node or {}).get("Students") or {}
    parents = (school_node or {}).get("Parents") or {}
    class_marks = (school_node or {}).get("ClassMarks") or {}
    lesson_plans = (school_node or {}).get("LessonPlans") or {}

    current_year_student_count = 0
    for student_node in students.values():
        student = student_node or {}
        basic = student.get("basicStudentInformation") or {}
        student_year = normalize_year_key(student.get("academicYear") or basic.get("academicYear"))
        if student_year == current_year:
            current_year_student_count += 1

    lesson_plan_archive = clone_payload(lesson_plans)
    if isinstance(lesson_plan_archive, dict):
        lesson_plan_archive.pop("StudentWhatLearn", None)

    return {
        "fromAcademicYear": current_year,
        "toAcademicYear": target_year,
        "archiveCounts": {
            "students": current_year_student_count,
            "parents": len(parents or {}),
            "classMarks": len(class_marks or {}),
            "lessonPlans": len(lesson_plan_archive or {}),
        },
        "deleteRoots": [
            "Students",
            "Parents",
            "ClassMarks",
            "LessonPlans",
            "AssesmentTemplates",
            "AssessmentTemplates",
        ],
        "resetNodes": [
            "Chats",
            "Attendance",
            "SchoolExams.AssessmentSubmissions",
            "SchoolExams.Assessments",
            "SchoolExams.CourseFeed",
            "SchoolExams.CourseStats",
            "SchoolExams.SubmissionIndex",
            "SchoolExams.QuestionUsage",
            "Employees_Attendance",
            "CalendarEvents",
            "StudentBookNotes",
            "Schedules",
            "GradeManagement.grades.*.sectionSubjectTeachers",
        ],
        "untouchedNodes": [
            "Users",
            "schoolInfo",
            "GradeManagement",
            "SchoolExams.QuestionBank",
            "SchoolExams.QuestionHashes",
        ],
    }


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

        # Invalidate server-side cache after parent write
        _invalidate_cached_node(school_code, "Parents")
        _invalidate_cached_node(school_code, "Students")
        _invalidate_cached_node(school_code, "Users")

        return jsonify({"success": True, "message": "Parent registered successfully", "parentId": parent_id, "userId": user_id}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/register/student", methods=["POST"])
@app.route("/api/register/student", methods=["POST"])
def register_student():
    try:
        name = (request.form.get("name") or "").strip()
        first_name = (request.form.get("firstName") or "").strip()
        middle_name = (request.form.get("middleName") or "").strip()
        last_name = (request.form.get("lastName") or "").strip()
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        grade = (request.form.get("grade") or "").strip()
        section = (request.form.get("section") or "").strip()
        email = (request.form.get("email") or "").strip()
        phone = (request.form.get("phone") or "").strip()
        gender = (request.form.get("gender") or "").strip()
        dob = (request.form.get("dob") or "").strip()
        admission_date = (request.form.get("admissionDate") or "").strip()
        previous_school = (request.form.get("previousSchool") or "").strip()
        national_id_number = (request.form.get("nationalIdNumber") or "").strip()
        region = (request.form.get("region") or "").strip()
        city = (request.form.get("city") or "").strip()
        sub_city = (request.form.get("subCity") or "").strip()
        kebele = (request.form.get("kebele") or "").strip()
        house_number = (request.form.get("houseNumber") or "").strip()
        registration_fee_paid = (request.form.get("registrationFeePaid") or "").strip()
        has_discount = (request.form.get("hasDiscount") or "").strip()
        discount_amount = (request.form.get("discountAmount") or "").strip()
        payment_plan_type = (request.form.get("paymentPlanType") or "").strip()
        transport_service = (request.form.get("transportService") or "").strip()
        blood_type = (request.form.get("bloodType") or "").strip()
        medical_condition = (request.form.get("medicalCondition") or "").strip()
        emergency_contact_name = (request.form.get("emergencyContactName") or "").strip()
        emergency_phone = (request.form.get("emergencyPhone") or "").strip()
        stream = (request.form.get("stream") or "").strip()
        special_program = (request.form.get("specialProgram") or "").strip()
        language_option = (request.form.get("languageOption") or "").strip()
        elective_subjects = (request.form.get("electiveSubjects") or "").strip()
        student_role = (request.form.get("role") or "student").strip() or "student"
        school_code = (request.form.get("schoolCode") or request.args.get("schoolCode") or "").strip()
        profile_file = request.files.get("studentPhoto") or request.files.get("profile")
        student_national_id_file = request.files.get("studentNationalIdImage")

        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        if not name:
            name = " ".join([v for v in [first_name, middle_name, last_name] if v]).strip()

        if not password:
            password = generate_temp_password(8)

        if not name or not grade or not section:
            return jsonify({"success": False, "message": "Name, grade and section are required."}), 400

        users_ref = school_ref(school_code).child("Users")
        students_ref = school_ref(school_code).child("Students")

        provided_student_id = (request.form.get("studentNumber") or request.form.get("studentId") or "").strip()
        student_id = provided_student_id or generate_scoped_id(school_code, "Students", "GES")

        # For students, keep username aligned to studentId in Users node
        username = student_id

        users = users_ref.get() or {}
        for _, u in users.items():
            row = u or {}
            if str(row.get("username") or "").lower() == username.lower():
                return jsonify({"success": False, "message": "Username already exists."}), 400
            existing_phone = str(row.get("phone") or row.get("Phone") or row.get("phoneNumber") or "").strip()
            if phone and existing_phone and existing_phone == phone:
                return jsonify({"success": False, "message": "Phone already exists."}), 400

        # Prevent duplicate studentId keys
        existing_student = students_ref.child(student_id).get()
        if existing_student:
            return jsonify({"success": False, "message": "Student ID already exists."}), 400

        profile_url = (request.form.get("profileImage") or "").strip() or "/default-profile.png"
        if profile_file:
            try:
                safe_student_key = (student_id or "student").replace("/", "_")
                safe_filename = os.path.basename(profile_file.filename or "photo.jpg")
                object_name = f"students/{safe_student_key}_{int(datetime.utcnow().timestamp())}_{safe_filename}"
                blob = bucket.blob(object_name)
                blob.upload_from_file(profile_file, content_type=profile_file.content_type)
                blob.make_public()
                profile_url = blob.public_url
            except Exception:
                # keep default/fallback profile image URL if upload fails
                pass

        national_id_image_url = ""
        if student_national_id_file:
            try:
                safe_student_key = (student_id or "student").replace("/", "_")
                safe_filename = os.path.basename(student_national_id_file.filename or "nid.jpg")
                object_name = f"national_ids/students/{safe_student_key}_{int(datetime.utcnow().timestamp())}_{safe_filename}"
                blob = bucket.blob(object_name)
                blob.upload_from_file(student_national_id_file, content_type=student_national_id_file.content_type)
                blob.make_public()
                national_id_image_url = blob.public_url
            except Exception:
                national_id_image_url = ""

        is_active_raw = str(request.form.get("isActive") or "true").strip().lower()
        is_active = is_active_raw in ("1", "true", "yes", "y", "on")

        status = (request.form.get("status") or "active").strip() or "active"

        new_user_ref = users_ref.push()
        user_id = new_user_ref.key

        registration_time = datetime.utcnow().isoformat()

        user_payload = {
            "userId": user_id,
            "name": name,
            "username": username,
            "password": password,
            "email": email,
            "phone": phone,
            "gender": gender,
            "dob": dob,
            "profileImage": profile_url,
            "role": "student",
            "isActive": is_active,
            "schoolCode": school_code,
            "studentId": student_id,
            "nationalIdNumber": national_id_number,
            "nationalIdImage": national_id_image_url,
            "createdAt": registration_time,
        }
        new_user_ref.set(user_payload)

        parents_raw = request.form.get("parents") or "[]"
        try:
            parents_list = json.loads(parents_raw)
            if not isinstance(parents_list, list):
                parents_list = []
        except Exception:
            parents_list = []

        parent_guardian_info = []
        for p in parents_list:
            p = p or {}
            parent_guardian_info.append({
                "parentId": (p.get("parentId") or "").strip(),
                "fullName": (p.get("fullName") or "").strip(),
                "relationship": (p.get("relationship") or "").strip(),
                "phone": (p.get("phone") or "").strip(),
                "alternativePhone": (p.get("alternativePhone") or "").strip(),
                "email": (p.get("email") or "").strip(),
                "occupation": (p.get("occupation") or "").strip(),
                "nationalIdNumber": (p.get("nationalIdNumber") or "").strip(),
                "profileImage": (p.get("profileImage") or "").strip(),
                "systemAccountInformation": {
                    "username": (p.get("username") or "").strip(),
                    "temporaryPassword": (p.get("temporaryPassword") or "").strip(),
                    "isActive": str(p.get("isActive") or "true").strip(),
                    "role": (p.get("role") or "parent").strip() or "parent",
                },
            })

        requested_academic_year = normalize_year_key(request.form.get("academicYear"))
        school_info = school_ref(school_code).child("schoolInfo").get() or {}
        active_academic_year = normalize_year_key((school_info or {}).get("currentAcademicYear"))
        academic_year = active_academic_year or requested_academic_year or f"{datetime.utcnow().year - 1}_{datetime.utcnow().year}"
        student_payload = {
            "studentId": student_id,
            "userId": user_id,
            "grade": grade,
            "section": section,
            "dob": dob,
            "status": status,
            "academicYear": academic_year,
            "name": name,
            "gender": gender,
            "registeredAt": registration_time,
            "createdAt": registration_time,
            "admissionDate": admission_date,
            "previousSchool": previous_school,
            "nationalIdNumber": national_id_number,
            "nationalIdImage": national_id_image_url,
            "profileImage": profile_url,
            "basicStudentInformation": {
                "studentId": student_id,
                "firstName": first_name,
                "middleName": middle_name,
                "lastName": last_name,
                "name": name,
                "gender": gender,
                "dob": dob,
                "admissionDate": admission_date,
                "academicYear": academic_year,
                "grade": grade,
                "section": section,
                "previousSchool": previous_school,
                "status": status,
                "studentPhoto": profile_url,
                "nationalIdNumber": national_id_number,
                "nationalIdImage": national_id_image_url,
            },
            "parentGuardianInformation": {
                "parents": parent_guardian_info,
            },
            "addressInformation": {
                "region": region,
                "city": city,
                "subCity": sub_city,
                "kebele": kebele,
                "houseNumber": house_number,
            },
            "financeInformation": {
                "registrationFeePaid": registration_fee_paid,
                "hasDiscount": has_discount,
                "discountAmount": discount_amount,
                "paymentPlanType": payment_plan_type,
                "transportService": transport_service,
            },
            "healthEmergency": {
                "bloodType": blood_type,
                "medicalCondition": medical_condition,
                "emergencyContactName": emergency_contact_name,
                "emergencyPhone": emergency_phone,
            },
            "academicSetup": {
                "stream": stream,
                "specialProgram": special_program,
                "languageOption": language_option,
                "electiveSubjects": elective_subjects,
            },
            "systemAccountInformation": {
                "username": username,
                "temporaryPassword": password,
                "isActive": is_active,
                "role": student_role,
                "userId": user_id,
            },
        }
        students_ref.child(student_id).set(student_payload)

        # Optional parent records from student registration payload
        parents_ref = school_ref(school_code).child("Parents")
        finalized_parent_guardian_info = []

        for idx, parent in enumerate(parents_list):
            parent = parent or {}
            parent_id = (parent.get("parentId") or "").strip() or generate_parent_id(school_code)
            parent_name = (parent.get("fullName") or "").strip() or "Parent"
            parent_phone = (parent.get("phone") or "").strip()
            parent_email = (parent.get("email") or "").strip()
            parent_relationship = (parent.get("relationship") or "Guardian").strip() or "Guardian"
            parent_occupation = (parent.get("occupation") or "").strip()
            parent_nid_number = (parent.get("nationalIdNumber") or "").strip()
            parent_profile_field = (parent.get("profileImageField") or f"parentProfileImage_{idx}").strip()
            parent_nid_field = (parent.get("nationalIdImageField") or f"parentNationalIdImage_{idx}").strip()
            parent_username = (parent.get("username") or "").strip() or parent_id
            parent_temp_password = (parent.get("temporaryPassword") or "").strip() or generate_temp_password(8)
            parent_role = (parent.get("role") or "parent").strip() or "parent"
            parent_is_active_raw = str(parent.get("isActive") or "true").strip().lower()
            parent_is_active = parent_is_active_raw in ("1", "true", "yes", "y", "on")

            parent_profile_url = (parent.get("profileImage") or "").strip() or "/default-profile.png"
            parent_profile_file = request.files.get(parent_profile_field)
            if parent_profile_file:
                try:
                    safe_parent_key = (parent_id or "parent").replace("/", "_")
                    safe_parent_filename = os.path.basename(parent_profile_file.filename or "profile.jpg")
                    object_name = f"parents/{safe_parent_key}_{int(datetime.utcnow().timestamp())}_{safe_parent_filename}"
                    blob = bucket.blob(object_name)
                    blob.upload_from_file(parent_profile_file, content_type=parent_profile_file.content_type)
                    blob.make_public()
                    parent_profile_url = blob.public_url
                except Exception:
                    parent_profile_url = "/default-profile.png"

            parent_nid_image_url = ""
            parent_nid_file = request.files.get(parent_nid_field)
            if parent_nid_file:
                try:
                    safe_parent_key = (parent_id or "parent").replace("/", "_")
                    safe_parent_filename = os.path.basename(parent_nid_file.filename or "nid.jpg")
                    object_name = f"national_ids/parents/{safe_parent_key}_{int(datetime.utcnow().timestamp())}_{safe_parent_filename}"
                    blob = bucket.blob(object_name)
                    blob.upload_from_file(parent_nid_file, content_type=parent_nid_file.content_type)
                    blob.make_public()
                    parent_nid_image_url = blob.public_url
                except Exception:
                    parent_nid_image_url = ""

            # Create parent user for compatibility with existing Students page lookups
            parent_user_ref = users_ref.push()
            parent_user_id = parent_user_ref.key

            # Ensure parent username is unique in Users
            all_users_map = users_ref.get() or {}
            existing_usernames = {str((u or {}).get("username") or "").lower() for u in all_users_map.values()}
            if parent_username.lower() in existing_usernames:
                parent_username = f"{parent_id}_{idx + 1}"
                suffix = 1
                while parent_username.lower() in existing_usernames:
                    suffix += 1
                    parent_username = f"{parent_id}_{idx + 1}_{suffix}"

            parent_user_payload = {
                "userId": parent_user_id,
                "name": parent_name,
                "username": parent_username,
                "password": parent_temp_password,
                "email": parent_email,
                "phone": parent_phone,
                "profileImage": parent_profile_url,
                "role": parent_role,
                "isActive": parent_is_active,
                "schoolCode": school_code,
                "parentId": parent_id,
                "nationalIdNumber": parent_nid_number,
                "nationalIdImage": parent_nid_image_url,
            }
            parent_user_ref.set(parent_user_payload)

            parent_payload = {
                "parentId": parent_id,
                "userId": parent_user_id,
                "name": parent_name,
                "phone": parent_phone,
                "email": parent_email,
                "occupation": parent_occupation,
                "profileImage": parent_profile_url,
                "nationalIdNumber": parent_nid_number,
                "nationalIdImage": parent_nid_image_url,
                "status": "active",
                "schoolCode": school_code,
                "createdAt": datetime.utcnow().isoformat(),
            }
            parents_ref.child(parent_id).set(parent_payload)

            students_ref.child(f"{student_id}/parents/{parent_id}").set({
                "relationship": parent_relationship,
                "userId": parent_user_id,
                "parentId": parent_id,
                "linkedAt": datetime.utcnow().isoformat(),
            })

            finalized_parent_guardian_info.append({
                "parentId": parent_id,
                "fullName": parent_name,
                "relationship": parent_relationship,
                "phone": parent_phone,
                "alternativePhone": (parent.get("alternativePhone") or "").strip(),
                "email": parent_email,
                "occupation": parent_occupation,
                "nationalIdNumber": parent_nid_number,
                "nationalIdImage": parent_nid_image_url,
                "profileImage": parent_profile_url,
                "systemAccountInformation": {
                    "username": parent_username,
                    "temporaryPassword": parent_temp_password,
                    "isActive": str(parent.get("isActive") or "true").strip(),
                    "role": parent_role,
                },
            })

        if finalized_parent_guardian_info:
            students_ref.child(f"{student_id}/parentGuardianInformation/parents").set(finalized_parent_guardian_info)

        # Invalidate server-side cache so the next registerer gets fresh data
        _invalidate_cached_node(school_code, "Students")
        _invalidate_cached_node(school_code, "Parents")
        _invalidate_cached_node(school_code, "Users")

        return jsonify({
            "success": True,
            "message": "Student registered successfully",
            "studentId": student_id,
            "username": username,
            "userId": user_id,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/register/registerer", methods=["POST"])
@app.route("/api/register/registerer", methods=["POST"])
def register_registerer():
    try:
        name = (request.form.get("name") or "").strip()
        password = request.form.get("password") or ""
        email = (request.form.get("email") or "").strip()
        phone = (request.form.get("phone") or "").strip()
        gender = (request.form.get("gender") or "").strip()
        school_code = (request.form.get("schoolCode") or request.args.get("schoolCode") or "").strip()

        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        if not name or not password or not phone:
            return jsonify({"success": False, "message": "Name, password and phone are required."}), 400

        users_ref = school_ref(school_code).child("Users")
        registerers_ref = school_ref(school_code).child("Registerers")

        registerer_id = generate_scoped_id(school_code, "Registerers", "GSR")
        username = registerer_id

        users = users_ref.get() or {}
        for _, u in users.items():
            row = u or {}
            if str(row.get("username") or "").lower() == username.lower():
                return jsonify({"success": False, "message": "Username already exists."}), 400
            existing_phone = str(row.get("phone") or row.get("Phone") or row.get("phoneNumber") or "").strip()
            if existing_phone and existing_phone == phone:
                return jsonify({"success": False, "message": "Phone already exists."}), 400

        profile_url = "/default-profile.png"

        new_user_ref = users_ref.push()
        user_id = new_user_ref.key

        user_payload = {
            "userId": user_id,
            "name": name,
            "username": username,
            "password": password,
            "email": email,
            "phone": phone,
            "gender": gender,
            "profileImage": profile_url,
            "role": "registerer",
            "isActive": True,
            "schoolCode": school_code,
            "employeeId": registerer_id,
        }
        new_user_ref.set(user_payload)

        registerer_payload = {
            "registererId": registerer_id,
            "userId": user_id,
            "status": "active",
            "createdAt": datetime.utcnow().isoformat(),
            "schoolCode": school_code,
            "phone": phone,
            "email": email,
        }
        registerers_ref.child(registerer_id).set(registerer_payload)

        return jsonify({
            "success": True,
            "message": "Registerer created successfully",
            "registererId": registerer_id,
            "username": username,
            "userId": user_id,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/register/teacher", methods=["POST"])
@app.route("/api/register/teacher", methods=["POST"])
def register_teacher():
    try:
        name = (request.form.get("name") or "").strip()
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        email = (request.form.get("email") or "").strip()
        phone = (request.form.get("phone") or "").strip()
        gender = (request.form.get("gender") or "").strip()
        school_code = (request.form.get("schoolCode") or request.args.get("schoolCode") or "").strip()

        courses_raw = request.form.get("courses") or "[]"
        try:
            courses = json.loads(courses_raw)
            if not isinstance(courses, list):
                courses = []
        except Exception:
            courses = []

        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        if not name or not password:
            return jsonify({"success": False, "message": "Name and password are required."}), 400

        users_ref = school_ref(school_code).child("Users")
        teachers_ref = school_ref(school_code).child("Teachers")

        teacher_id = generate_scoped_id(school_code, "Teachers", "GET")
        if not username:
            username = teacher_id

        users = users_ref.get() or {}
        for _, u in users.items():
            row = u or {}
            if str(row.get("username") or "").lower() == username.lower():
                return jsonify({"success": False, "message": "Username already exists."}), 400
            existing_phone = str(row.get("phone") or row.get("Phone") or row.get("phoneNumber") or "").strip()
            if phone and existing_phone and existing_phone == phone:
                return jsonify({"success": False, "message": "Phone already exists."}), 400

        profile_url = "/default-profile.png"

        new_user_ref = users_ref.push()
        user_id = new_user_ref.key

        user_payload = {
            "userId": user_id,
            "name": name,
            "username": username,
            "password": password,
            "email": email,
            "phone": phone,
            "gender": gender,
            "profileImage": profile_url,
            "role": "teacher",
            "isActive": True,
            "schoolCode": school_code,
            "teacherId": teacher_id,
        }
        new_user_ref.set(user_payload)

        teacher_payload = {
            "teacherId": teacher_id,
            "userId": user_id,
            "courses": courses,
            "status": "active",
            "createdAt": datetime.utcnow().isoformat(),
            "schoolCode": school_code,
        }
        teachers_ref.child(teacher_id).set(teacher_payload)

        return jsonify({
            "success": True,
            "message": "Teacher registered successfully",
            "teacherId": teacher_id,
            "username": username,
            "userId": user_id,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/login", methods=["POST"])
def login_registrar():
    try:
        data = request.get_json(force=True)
        username = data.get("username")
        password = data.get("password")

        username_input = str(username or "").strip()
        password_input = "" if password is None else str(password)

        if not username_input or password is None or not str(password_input).strip():
            return jsonify({"success": False, "message": "Missing credentials"}), 400

        all_schools = schools_data()
        matched_user = None
        matched_school_code = None

        for school_code, school_node in all_schools.items():
            users = (school_node or {}).get("Users") or {}
            for uid, u in users.items():
                stored_username = str((u or {}).get("username") or "").strip()
                stored_password = "" if (u or {}).get("password") is None else str((u or {}).get("password"))

                if stored_username.lower() == username_input.lower() and stored_password == password_input:
                    matched_user = {"userId": uid, **(u or {})}
                    matched_school_code = school_code
                    break
            if matched_user:
                break

        if not matched_user:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401

        def normalize_text(value):
            return str(value or "").strip().lower().replace("_", " ").replace("-", " ")

        role = normalize_text(matched_user.get("role"))
        username_value = str(matched_user.get("username") or "").strip().upper()

        if role != "registerer":
            return jsonify({
                "success": False,
                "message": "Only registerer accounts can login to this portal"
            }), 403

        registerers = ((all_schools.get(matched_school_code) or {}).get("Registerers") or {})
        matched_registerer = None
        for rid, reg in registerers.items():
            row = reg or {}
            if str(rid or "").strip().upper() == username_value or row.get("userId") == matched_user.get("userId"):
                matched_registerer = {"registererId": rid, **row}
                break

        if not matched_registerer:
            return jsonify({
                "success": False,
                "message": "Registerer profile not found for this account"
            }), 403

        registrar_record = {
            "registrarId": matched_registerer.get("registererId") or matched_user.get("employeeId") or matched_user.get("userId"),
            "userId": matched_user.get("userId"),
            "employeeId": matched_user.get("employeeId"),
            "schoolCode": matched_school_code,
        }

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
            "registrar": registrar_record,
        }

        resp["schoolCode"] = matched_school_code

        return jsonify(resp)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        def normalize_target_role(raw_value):
            value = str(raw_value or "all").strip().lower()
            aliases = {
                "all": "all",
                "student": "student",
                "students": "student",
                "parent": "parent",
                "parents": "parent",
                "teacher": "teacher",
                "teachers": "teacher",
                "registerer": "registerer",
                "registerers": "registerer",
                "registrar": "registerer",
                "registrars": "registerer",
                "finance": "finance",
                "admin": "admin",
                "admins": "admin",
            }
            return aliases.get(value, value or "all")

        data = request.form
        message = data.get("message") or data.get("postText") or ""
        raw_post_url = data.get("postUrl") or ""
        media_file = request.files.get("post_media")
        if media_file is None:
            media_file = request.files.get("postMedia")

        raw_admin_id = str(data.get("adminId") or "").strip()
        finance_id = str(data.get("financeId") or "").strip()
        user_id = str(data.get("userId") or "").strip()
        owner_user_id = user_id or raw_admin_id or finance_id
        compatibility_finance_id = finance_id or raw_admin_id
        admin_name = data.get("adminName") or data.get("financeName") or "Register Office"
        admin_profile = data.get("adminProfile") or data.get("financeProfile") or "/default-profile.png"
        targetRole = normalize_target_role(data.get("targetRole") or data.get("target") or "all")
        schoolCode = data.get("schoolCode") or request.args.get("schoolCode") or ""
        has_media_file = media_file is not None and getattr(media_file, "stream", None) is not None

        if not owner_user_id and not compatibility_finance_id:
            return jsonify({"success": False, "message": "Admin not logged in"}), 400

        if not schoolCode:
            schoolCode = find_school_code_for_user(
                user_id=owner_user_id or user_id,
                finance_id=compatibility_finance_id,
            )

        if not schoolCode:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        post_url = raw_post_url
        if has_media_file:
            post_url = upload_file_to_firebase(media_file, folder="posts")
            if not post_url:
                return jsonify({"success": False, "message": "Failed to upload post media"}), 500

        time_now = datetime.utcnow().isoformat()

        post_ref = school_ref(schoolCode).child("Posts").push()
        post_obj = {
            "postId": post_ref.key,
            "message": message,
            "postUrl": post_url,
            "adminId": owner_user_id,
            "userId": owner_user_id,
            "adminName": admin_name,
            "adminProfile": admin_profile,
            "schoolCode": schoolCode,
            "targetRole": targetRole,
            "time": time_now,
            "createdAt": time_now,
            "likeCount": 0,
            "likes": {},
            "seenBy": {},
        }

        if owner_user_id:
            post_obj["seenBy"][owner_user_id] = True
        if compatibility_finance_id and compatibility_finance_id != owner_user_id:
            post_obj["financeId"] = compatibility_finance_id
            post_obj["seenBy"][compatibility_finance_id] = True

        post_ref.set(post_obj)

        created = school_ref(schoolCode).child(f"Posts/{post_ref.key}").get() or {}
        created["postId"] = post_ref.key
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


@app.route("/api/like_post", methods=["POST"])
def like_post():
    try:
        body = request.get_json(silent=True) or {}
        post_id = (
            body.get("postId")
            or request.form.get("postId")
            or request.args.get("postId")
            or ""
        ).strip()
        actor_id = str(
            body.get("userId")
            or body.get("adminId")
            or body.get("financeId")
            or request.form.get("userId")
            or request.form.get("adminId")
            or request.form.get("financeId")
            or request.args.get("userId")
            or request.args.get("adminId")
            or request.args.get("financeId")
            or ""
        ).strip()
        school_code = (
            body.get("schoolCode")
            or request.form.get("schoolCode")
            or request.args.get("schoolCode")
            or ""
        ).strip()

        if not post_id:
            return jsonify({"success": False, "message": "postId is required"}), 400
        if not actor_id:
            return jsonify({"success": False, "message": "user identifier is required"}), 400

        post_data = None
        resolved_school_code = school_code

        if resolved_school_code:
            post_data = school_ref(resolved_school_code).child(f"Posts/{post_id}").get()

        if not post_data:
            all_schools = schools_data()
            for code, school_node in all_schools.items():
                candidate = ((school_node or {}).get("Posts") or {}).get(post_id)
                if candidate:
                    resolved_school_code = code
                    post_data = candidate
                    break

        if not resolved_school_code or not post_data:
            return jsonify({"success": False, "message": "Post not found"}), 404

        likes = post_data.get("likes") if isinstance(post_data.get("likes"), dict) else {}
        liked = False

        if likes.get(actor_id):
            likes.pop(actor_id, None)
        else:
            likes[actor_id] = True
            liked = True

        like_count = len([value for value in likes.values() if value])
        post_ref = school_ref(resolved_school_code).child(f"Posts/{post_id}")
        post_ref.update({"likes": likes, "likeCount": like_count})

        return jsonify({
            "success": True,
            "liked": liked,
            "likeCount": like_count,
            "likes": likes,
            "postId": post_id,
            "schoolCode": resolved_school_code,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/get_students", methods=["GET"])
def get_students():
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        # Reuse the shared server-side cache so ParentRegister does not bypass
        # the large-node proxy and trigger a fresh 10 MB Students read per user.
        students = get_school_node_cached(school_code, "Students") or {}
        result = []
        if isinstance(students, dict):
            for key, val in students.items():
                item = val or {}
                item["studentId"] = key
                result.append(item)

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Cached node proxy endpoints — all 100 registerers share a single RTDB read
# per 30-minute window instead of each triggering their own 10 MB download.
# ---------------------------------------------------------------------------

@app.route("/api/nodes/Students", methods=["GET"])
def proxy_students_node():
    """Return the full Students node for a school, served from server cache."""
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400
        data = get_school_node_cached(school_code, "Students")
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/nodes/Parents", methods=["GET"])
def proxy_parents_node():
    """Return the full Parents node for a school, served from server cache."""
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400
        data = get_school_node_cached(school_code, "Parents")
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/nodes/Teachers", methods=["GET"])
def proxy_teachers_node():
    """Return the full Teachers node for a school, served from server cache."""
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400
        data = get_school_node_cached(school_code, "Teachers")
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/api/nodes/Users", methods=["GET"])
def proxy_users_node():
    """Return the full Users node for a school, served from server cache."""
    try:
        school_code = request.args.get("schoolCode")
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400
        data = get_school_node_cached(school_code, "Users")
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/academic-years", methods=["GET"])
@app.route("/api/academic-years", methods=["GET"])
def get_academic_years():
    try:
        school_code = get_school_code_from_request()
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        school_node = school_ref(school_code).get() or {}
        years = (school_node or {}).get("AcademicYears") or {}
        current_year = ((school_node or {}).get("schoolInfo") or {}).get("currentAcademicYear")

        return jsonify({
            "success": True,
            "academicYears": years,
            "currentAcademicYear": current_year,
            "schoolCode": school_code,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/create", methods=["POST"])
@app.route("/api/academic-years/create", methods=["POST"])
def create_academic_year():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        start_year_raw = (
            request.form.get("startYear")
            or request.args.get("startYear")
            or body.get("startYear")
            or ""
        )
        year_key_raw = (
            request.form.get("yearKey")
            or request.args.get("yearKey")
            or body.get("yearKey")
            or ""
        )

        year_key = normalize_year_key(year_key_raw or start_year_raw)
        if not year_key:
            return jsonify({"success": False, "message": "Valid academic year is required (e.g. 2026 or 2026_2027)."}), 400

        year_label = year_label_from_key(year_key)
        activate_now_raw = str(body.get("activateNow") or request.form.get("activateNow") or "false").strip().lower()
        activate_now = activate_now_raw in ("1", "true", "yes", "y", "on")

        years_ref = school_ref(school_code).child("AcademicYears")
        existing = years_ref.child(year_key).get()
        if existing:
            return jsonify({"success": False, "message": f"Academic year {year_label} already exists."}), 409

        payload = {
            "yearKey": year_key,
            "label": year_label,
            "status": "active" if activate_now else "inactive",
            "isCurrent": bool(activate_now),
            "createdAt": datetime.utcnow().isoformat(),
        }
        years_ref.child(year_key).set(payload)

        if activate_now:
            all_years = years_ref.get() or {}
            for key in all_years.keys():
                if key != year_key:
                    current_status = str((all_years.get(key) or {}).get("status") or "inactive").strip().lower()
                    next_status = "archived" if current_status == "archived" else "inactive"
                    years_ref.child(key).update({"isCurrent": False, "status": next_status})
            school_ref(school_code).child("schoolInfo").update({"currentAcademicYear": year_key})

        return jsonify({
            "success": True,
            "message": f"Academic year {year_label} created successfully.",
            "yearKey": year_key,
            "academicYear": payload,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/activate", methods=["POST"])
@app.route("/api/academic-years/activate", methods=["POST"])
def activate_academic_year():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        year_key = normalize_year_key(
            request.form.get("yearKey")
            or request.args.get("yearKey")
            or body.get("yearKey")
            or ""
        )
        if not year_key:
            return jsonify({"success": False, "message": "yearKey is required."}), 400

        years_ref = school_ref(school_code).child("AcademicYears")
        years = years_ref.get() or {}
        if year_key not in years:
            return jsonify({"success": False, "message": f"Academic year {year_key} does not exist."}), 404

        for key, value in (years or {}).items():
            row = value or {}
            current_status = str(row.get("status") or "inactive").strip().lower()
            next_status = "active" if key == year_key else ("archived" if current_status == "archived" else "inactive")
            years_ref.child(key).update({
                "isCurrent": key == year_key,
                "status": next_status,
                "updatedAt": datetime.utcnow().isoformat(),
            })

        school_ref(school_code).child("schoolInfo").update({"currentAcademicYear": year_key})
        return jsonify({"success": True, "message": f"Academic year {year_label_from_key(year_key)} activated.", "yearKey": year_key}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/archive", methods=["POST"])
@app.route("/api/academic-years/archive", methods=["POST"])
def archive_academic_year():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        year_key = normalize_year_key(
            request.form.get("yearKey")
            or request.args.get("yearKey")
            or body.get("yearKey")
            or ""
        )
        if not year_key:
            return jsonify({"success": False, "message": "yearKey is required."}), 400

        years_ref = school_ref(school_code).child("AcademicYears")
        year_node = years_ref.child(year_key).get()
        if not year_node:
            return jsonify({"success": False, "message": f"Academic year {year_key} does not exist."}), 404

        years_ref.child(year_key).update({
            "status": "archived",
            "isCurrent": False,
            "archivedAt": datetime.utcnow().isoformat(),
        })

        current_year = (school_ref(school_code).child("schoolInfo").get() or {}).get("currentAcademicYear")
        if current_year == year_key:
            school_ref(school_code).child("schoolInfo").update({"currentAcademicYear": None})

        return jsonify({"success": True, "message": f"Academic year {year_label_from_key(year_key)} archived.", "yearKey": year_key}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/rollover/pending", methods=["GET"])
@app.route("/api/academic-years/rollover/pending", methods=["GET"])
def get_pending_rollover():
    try:
        school_code = get_school_code_from_request()
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        pending_request = pending_rollover_ref(school_code).get() or {}
        if not pending_request or str(pending_request.get("status") or "") != "armed":
            return jsonify({"success": True, "pendingRequest": None}), 200

        return jsonify({"success": True, "pendingRequest": pending_request}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/rollover/arm", methods=["POST"])
@app.route("/api/academic-years/rollover/arm", methods=["POST"])
def arm_rollover_guard():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        actor_user_id = str(body.get("actorUserId") or body.get("userId") or "").strip()
        password = body.get("password") or ""
        requested_target = normalize_year_key(body.get("targetYearKey") or body.get("startYear") or "")
        confirmation_phrase = str(body.get("confirmationPhrase") or "").strip()

        try:
            delay_seconds = int(body.get("delaySeconds") or 3600)
        except Exception:
            delay_seconds = 3600

        if delay_seconds not in ROLLOVER_ALLOWED_DELAYS:
            return jsonify({"success": False, "message": "Invalid countdown duration selected."}), 400

        actor = verify_registerer_password(school_code, actor_user_id, password)
        if not actor:
            return jsonify({"success": False, "message": "Registerer password verification failed."}), 403

        school_node = school_ref(school_code).get() or {}
        current_year = get_current_academic_year(school_node)
        if not current_year:
            return jsonify({"success": False, "message": "No current academic year is set."}), 400

        if not requested_target:
            return jsonify({"success": False, "message": "targetYearKey is required."}), 400

        if requested_target == current_year:
            return jsonify({"success": False, "message": "Target year must be different from current year."}), 400

        years = (school_node or {}).get("AcademicYears") or {}
        if requested_target not in years:
            return jsonify({"success": False, "message": "Target academic year does not exist."}), 404

        expected_phrase = f"ROLL OVER {current_year} TO {requested_target}"
        if confirmation_phrase != expected_phrase:
            return jsonify({"success": False, "message": f'Typed phrase must exactly match "{expected_phrase}".'}), 400

        existing_pending = pending_rollover_ref(school_code).get() or {}
        if existing_pending and str(existing_pending.get("status") or "") == "armed":
            return jsonify({
                "success": False,
                "message": "A guarded rollover is already armed. Cancel it first or execute it when the countdown completes.",
                "pendingRequest": existing_pending,
            }), 409

        created_at = datetime.now(timezone.utc)
        execute_after = datetime.fromtimestamp(created_at.timestamp() + delay_seconds, tz=timezone.utc)
        request_id = generate_request_id()
        preview = build_rollover_guard_preview(school_node, current_year, requested_target)

        pending_request = {
            "requestId": request_id,
            "status": "armed",
            "createdAt": created_at.isoformat().replace("+00:00", "Z"),
            "executeAfter": execute_after.isoformat().replace("+00:00", "Z"),
            "delaySeconds": delay_seconds,
            "currentYear": current_year,
            "targetYear": requested_target,
            "expectedPhrase": expected_phrase,
            "initiatedBy": {
                "userId": actor.get("userId"),
                "username": actor.get("username"),
                "name": actor.get("name"),
                "registrarId": body.get("actorRegistrarId") or actor.get("employeeId") or actor.get("username"),
            },
            "preview": preview,
        }

        pending_rollover_ref(school_code).set(pending_request)
        rollover_history_ref(school_code).child(request_id).set(pending_request)

        return jsonify({
            "success": True,
            "message": "Rollover guard armed. The waiting countdown has started and rollover execution is locked until the timer ends.",
            "pendingRequest": pending_request,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/rollover/cancel", methods=["POST"])
@app.route("/api/academic-years/rollover/cancel", methods=["POST"])
def cancel_rollover_guard():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        request_id = str(body.get("requestId") or "").strip()
        actor_user_id = str(body.get("actorUserId") or body.get("userId") or "").strip()
        if not request_id:
            return jsonify({"success": False, "message": "requestId is required."}), 400

        pending_request = pending_rollover_ref(school_code).get() or {}
        if not pending_request or str(pending_request.get("requestId") or "") != request_id:
            return jsonify({"success": False, "message": "Pending rollover request not found."}), 404

        initiated_by = (pending_request.get("initiatedBy") or {}).get("userId")
        if initiated_by and actor_user_id and initiated_by != actor_user_id:
            return jsonify({"success": False, "message": "Only the registerer who armed this rollover can cancel it."}), 403

        cancelled_at = utc_now_iso()
        rollover_history_ref(school_code).child(request_id).update({
            "status": "cancelled",
            "cancelledAt": cancelled_at,
            "cancelledBy": actor_user_id or initiated_by or "",
        })
        pending_rollover_ref(school_code).delete()

        return jsonify({"success": True, "message": "Pending rollover cancelled."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/academic-years/rollover", methods=["POST"])
@app.route("/api/academic-years/rollover", methods=["POST"])
def rollover_academic_year():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

        request_id = str(body.get("requestId") or "").strip()
        actor_user_id = str(body.get("actorUserId") or body.get("userId") or "").strip()
        if not request_id:
            return jsonify({"success": False, "message": "Arm the rollover first. A guarded rollover requestId is required."}), 400

        pending_request = pending_rollover_ref(school_code).get() or {}
        if not pending_request or str(pending_request.get("requestId") or "") != request_id:
            return jsonify({"success": False, "message": "Pending guarded rollover not found. Arm the rollover again."}), 404

        if str(pending_request.get("status") or "") != "armed":
            return jsonify({"success": False, "message": "This rollover request is no longer active."}), 409

        initiated_by_user_id = str(((pending_request.get("initiatedBy") or {}).get("userId") or "")).strip()
        if initiated_by_user_id and actor_user_id and actor_user_id != initiated_by_user_id:
            return jsonify({"success": False, "message": "Only the registerer who armed this rollover can execute it."}), 403

        execute_after = parse_iso_datetime(pending_request.get("executeAfter"))
        if execute_after is None:
            return jsonify({"success": False, "message": "Pending rollover executeAfter is invalid."}), 500

        if datetime.utcnow() < execute_after:
            return jsonify({
                "success": False,
                "message": "Countdown still active. Rollover is force-locked until the selected waiting time fully ends. You may only cancel it during this waiting period.",
                "executeAfter": pending_request.get("executeAfter"),
            }), 409

        max_grade_raw = request.form.get("maxGrade") or body.get("maxGrade") or 12
        try:
            max_grade = int(max_grade_raw)
        except Exception:
            max_grade = 12

        reset_yearly_raw = str(request.form.get("resetYearlyData") or body.get("resetYearlyData") or "true").strip().lower()
        reset_yearly_data = reset_yearly_raw in ("1", "true", "yes", "y", "on")

        requested_target = normalize_year_key(
            request.form.get("targetYearKey")
            or body.get("targetYearKey")
            or request.form.get("startYear")
            or body.get("startYear")
            or ""
        )

        school_node = school_ref(school_code).get() or {}
        school_info = (school_node or {}).get("schoolInfo") or {}
        years_ref = school_ref(school_code).child("AcademicYears")
        years = (school_node or {}).get("AcademicYears") or {}
        year_history = (school_node or {}).get("YearHistory") or {}

        def safe_number(value):
            if isinstance(value, bool):
                return None
            if isinstance(value, (int, float)):
                return float(value)
            text = str(value or "").strip().replace("%", "")
            if not text:
                return None
            try:
                return float(text)
            except Exception:
                return None

        def normalize_score(score):
            numeric = safe_number(score)
            if numeric is None:
                return None
            rounded = round(numeric, 2)
            if float(rounded).is_integer():
                return int(rounded)
            return rounded

        def first_non_empty(*values):
            for value in values:
                text = str(value or "").strip()
                if text:
                    return text
            return ""

        def extract_final_score(node):
            direct = safe_number(node)
            if direct is not None:
                return direct

            if not isinstance(node, dict):
                return None

            direct_keys = (
                "finalScore",
                "final_score",
                "finalMark",
                "final_mark",
                "final",
                "average",
                "avg",
                "totalAverage",
                "overallAverage",
                "yearAverage",
                "semesterAverage",
                "subjectAverage",
                "result",
                "score",
                "total",
            )
            for key in direct_keys:
                numeric = safe_number(node.get(key))
                if numeric is not None:
                    return numeric

            period_scores = []
            for key, value in node.items():
                lower = str(key or "").strip().lower()
                if lower in {"semester1", "semester2", "quarter1", "quarter2", "quarter3", "quarter4"}:
                    numeric = extract_final_score(value)
                    if numeric is not None:
                        period_scores.append(numeric)
            if period_scores:
                return sum(period_scores) / len(period_scores)

            nested_scores = []
            for key, value in node.items():
                lower = str(key or "").strip().lower()
                if lower in {"teacher", "teachername", "teacherid", "userid", "studentid", "grade", "section"}:
                    continue
                if isinstance(value, dict):
                    numeric = extract_final_score(value)
                    if numeric is not None:
                        nested_scores.append(numeric)
                        continue
                if any(token in lower for token in ("score", "mark", "total", "average", "avg", "result", "final")):
                    numeric = safe_number(value)
                    if numeric is not None:
                        nested_scores.append(numeric)
            if nested_scores:
                return sum(nested_scores) / len(nested_scores)

            return None

        def extract_student_year(student_node):
            student = student_node or {}
            basic = student.get("basicStudentInformation") or {}
            return normalize_year_key(student.get("academicYear") or basic.get("academicYear"))

        def summarize_status(raw_status):
            status_text = str(raw_status or "active").strip().lower()
            if "withdraw" in status_text:
                return "withdrawn"
            if "transfer" in status_text:
                return "withdrawn"
            if "graduate" in status_text:
                return "graduated"
            return status_text or "active"

        def clone_json(value):
            return json.loads(json.dumps(value))

        school_exam_reset_keys = {
            "AssessmentSubmissions",
            "Assessments",
            "CourseFeed",
            "CourseStats",
            "SubmissionIndex",
            "QuestionUsage",
        }
        cleared_nodes_template = [
            "Chats",
            "Attendance",
            "SchoolExams.AssessmentSubmissions",
            "SchoolExams.Assessments",
            "SchoolExams.CourseFeed",
            "SchoolExams.CourseStats",
            "SchoolExams.SubmissionIndex",
            "SchoolExams.QuestionUsage",
            "Employees_Attendance",
            "CalendarEvents",
            "StudentBookNotes",
            "Schedules",
            "GradeManagement.grades.*.sectionSubjectTeachers",
            "AssesmentTemplates",
            "AssessmentTemplates",
        ]

        current_year = school_info.get("currentAcademicYear")
        if not current_year:
            for key, value in (years or {}).items():
                if (value or {}).get("isCurrent"):
                    current_year = key
                    break

        if not current_year:
            return jsonify({"success": False, "message": "No current academic year is set. Activate a year first."}), 400

        if requested_target:
            target_year = requested_target
        else:
            normalized_current = normalize_year_key(current_year)
            if not normalized_current:
                return jsonify({"success": False, "message": "Current academic year format is invalid."}), 400
            start, end = normalized_current.split("_")
            target_year = f"{int(start) + 1}_{int(end) + 1}"

        if target_year == normalize_year_key(current_year):
            return jsonify({"success": False, "message": "Target year must be different from current year."}), 400

        target_year_node = years_ref.child(target_year).get()
        if not target_year_node:
            years_ref.child(target_year).set({
                "yearKey": target_year,
                "label": year_label_from_key(target_year),
                "status": "inactive",
                "isCurrent": False,
                "createdAt": datetime.utcnow().isoformat(),
            })

        normalized_current_year = normalize_year_key(current_year)
        if not normalized_current_year:
            return jsonify({"success": False, "message": "Current academic year format is invalid."}), 400

        if normalize_year_key(pending_request.get("currentYear")) != normalized_current_year:
            return jsonify({"success": False, "message": "Current academic year changed after the rollover was armed. Cancel and re-arm the rollover."}), 409

        if normalize_year_key(pending_request.get("targetYear")) != target_year:
            return jsonify({"success": False, "message": "Target year does not match the armed rollover request."}), 409

        current_year_node = (years or {}).get(normalized_current_year) or {}
        existing_archive = (year_history or {}).get(normalized_current_year) or {}
        existing_archive_meta = (existing_archive or {}).get("rolloverMeta") or {}

        if (
            existing_archive_meta.get("rolledToYear") == target_year
            or existing_archive_meta.get("toAcademicYear") == target_year
        ) and (
            str((current_year_node or {}).get("status") or "").strip().lower() == "completed"
            and normalize_year_key(school_info.get("currentAcademicYear")) == target_year
        ):
            executed_at = utc_now_iso()
            rollover_history_ref(school_code).child(request_id).update({
                "status": "executed",
                "executedAt": executed_at,
                "result": {
                    "fromAcademicYear": normalized_current_year,
                    "toAcademicYear": target_year,
                    "promoted": int(existing_archive_meta.get("promoted") or 0),
                    "repeated": int(existing_archive_meta.get("repeated") or 0),
                    "graduated": int(existing_archive_meta.get("graduated") or 0),
                    "withdrawn": int(existing_archive_meta.get("withdrawn") or 0),
                },
            })
            pending_rollover_ref(school_code).delete()
            return jsonify({
                "success": True,
                "message": f"Rollover already completed to {year_label_from_key(target_year)}.",
                "fromYear": normalized_current_year,
                "toYear": target_year,
                "promoted": int(existing_archive_meta.get("promoted") or 0),
                "repeated": int(existing_archive_meta.get("repeated") or 0),
                "graduated": int(existing_archive_meta.get("graduated") or 0),
                "withdrawn": int(existing_archive_meta.get("withdrawn") or 0),
                "studentsArchived": int(existing_archive_meta.get("studentsArchived") or 0),
                "resetSummary": {
                    "clearedNodes": cleared_nodes_template,
                    "archivePath": f"YearHistory/{normalized_current_year}",
                },
            }), 200

        now_iso = datetime.utcnow().isoformat()

        students = (school_node or {}).get("Students") or {}
        parents = (school_node or {}).get("Parents") or {}
        users = (school_node or {}).get("Users") or {}
        courses = (school_node or {}).get("Courses") or {}
        class_marks = (school_node or {}).get("ClassMarks") or {}
        attendance = (school_node or {}).get("Attendance") or {}
        lesson_plans = (school_node or {}).get("LessonPlans") or {}
        promotion_pass_mark = safe_number(((school_info.get("settings") or {}).get("academic") or {}).get("promotionPassMark"))
        if promotion_pass_mark is None:
            promotion_pass_mark = 50.0

        student_results_map = {}
        for course_id, roster in (class_marks or {}).items():
            if not isinstance(roster, dict):
                continue

            course_row = (courses or {}).get(course_id) or {}
            subject_name = first_non_empty(course_row.get("subject"), course_row.get("name"), course_row.get("courseId"), course_id)
            if not subject_name:
                continue

            for student_id, mark_node in roster.items():
                final_score = extract_final_score(mark_node)
                if final_score is None:
                    continue

                student_bucket = student_results_map.setdefault(str(student_id), {})
                student_bucket.setdefault(subject_name, []).append(final_score)

        student_attendance_map = {}
        for _, dates_node in (attendance or {}).items():
            if not isinstance(dates_node, dict):
                continue

            for _, attendance_by_student in dates_node.items():
                if not isinstance(attendance_by_student, dict):
                    continue

                for student_id, raw_status in attendance_by_student.items():
                    status_text = str(raw_status or "").strip().lower()
                    if not status_text:
                        continue

                    bucket = student_attendance_map.setdefault(str(student_id), {
                        "present": 0,
                        "absent": 0,
                        "late": 0,
                    })
                    if status_text.startswith("present"):
                        bucket["present"] += 1
                    elif status_text.startswith("late"):
                        bucket["late"] += 1
                    elif status_text.startswith("absent"):
                        bucket["absent"] += 1

        promoted = 0
        repeated = 0
        graduated = 0
        withdrawn = 0
        students_archived = 0
        deactivated_user_ids = set()

        root_updates = {}
        current_year_label = first_non_empty(current_year_node.get("label"), year_label_from_key(normalized_current_year))
        history_root = f"YearHistory/{normalized_current_year}"

        parents_history = clone_json(parents)
        if isinstance(parents_history, dict):
            for parent_id, parent_node in parents_history.items():
                if not isinstance(parent_node, dict):
                    continue
                parent_user_id = first_non_empty(parent_node.get("userId"))
                if parent_user_id:
                    deactivated_user_ids.add(parent_user_id)
                parent_node["isActive"] = False

                for user_id, user_node in (users or {}).items():
                    if str((user_node or {}).get("parentId") or "").strip() == str(parent_id or "").strip():
                        deactivated_user_ids.add(str(user_id))

        root_updates[f"{history_root}/Parents"] = parents_history
        root_updates[f"{history_root}/ClassMarks"] = clone_json(class_marks)

        lesson_plans_history = clone_json(lesson_plans)
        if isinstance(lesson_plans_history, dict):
            lesson_plans_history.pop("StudentWhatLearn", None)
        root_updates[f"{history_root}/LessonPlans"] = lesson_plans_history

        for student_id, node in (students or {}).items():
            student = node or {}
            student_year = extract_student_year(student)
            if student_year != normalized_current_year:
                continue

            student_user_id = first_non_empty(
                student.get("userId"),
                ((student.get("systemAccountInformation") or {}).get("userId")),
            )
            if student_user_id:
                deactivated_user_ids.add(student_user_id)
            else:
                for user_id, user_node in (users or {}).items():
                    if str((user_node or {}).get("studentId") or "").strip() == str(student_id).strip():
                        deactivated_user_ids.add(str(user_id))

            linked_parents = student.get("parents") or {}
            if isinstance(linked_parents, dict):
                for parent_link in linked_parents.values():
                    parent_user_id = first_non_empty((parent_link or {}).get("userId"))
                    if parent_user_id:
                        deactivated_user_ids.add(parent_user_id)

            basic = student.get("basicStudentInformation") or {}
            current_grade_text = first_non_empty(student.get("grade"), basic.get("grade"))
            current_section = first_non_empty(student.get("section"), basic.get("section")).upper()
            current_status = summarize_status(student.get("status") or basic.get("status") or "active")
            current_grade_num = None
            try:
                current_grade_num = int(str(current_grade_text).strip())
            except Exception:
                current_grade_num = None

            raw_results = student_results_map.get(str(student_id), {})
            final_results = {}
            for subject_name, scores in raw_results.items():
                usable_scores = [safe_number(score) for score in (scores or [])]
                usable_scores = [score for score in usable_scores if score is not None]
                if not usable_scores:
                    continue
                final_results[subject_name] = normalize_score(sum(usable_scores) / len(usable_scores))

            attendance_summary = {
                "present": int((student_attendance_map.get(str(student_id)) or {}).get("present") or 0),
                "absent": int((student_attendance_map.get(str(student_id)) or {}).get("absent") or 0),
                "late": int((student_attendance_map.get(str(student_id)) or {}).get("late") or 0),
            }

            score_values = [safe_number(score) for score in final_results.values()]
            score_values = [score for score in score_values if score is not None]
            average_score = (sum(score_values) / len(score_values)) if score_values else None
            passed = average_score is None or average_score >= promotion_pass_mark

            archive_status = current_status
            promoted_to = current_grade_text
            next_grade = current_grade_text

            if current_status == "withdrawn":
                archive_status = "withdrawn"
                withdrawn += 1
            elif current_status == "graduated":
                archive_status = "graduated"
                graduated += 1
            elif current_grade_num is None:
                archive_status = "repeated"
                repeated += 1
            elif passed and current_grade_num >= max_grade:
                archive_status = "graduated"
                graduated += 1
            elif passed:
                archive_status = "promoted"
                promoted += 1
                promoted_to = str(current_grade_num + 1)
                next_grade = promoted_to
            else:
                archive_status = "repeated"
                repeated += 1

            history_basic = {
                **basic,
                "academicYear": normalized_current_year,
                "grade": current_grade_text,
                "section": current_section,
                "status": archive_status,
                "studentId": student.get("studentId") or basic.get("studentId") or student_id,
                "name": student.get("name") or basic.get("name") or "Student",
            }

            history_records = {
                **(student.get("records") if isinstance(student.get("records"), dict) else {}),
                normalized_current_year: {
                    **((student.get("records") or {}).get(normalized_current_year) or {}),
                    "academicYear": normalized_current_year,
                    "grade": current_grade_text,
                    "section": current_section,
                    "status": archive_status,
                    "rolledOverAt": now_iso,
                },
            }

            history_student_payload = clone_json(student)
            history_system_account = history_student_payload.get("systemAccountInformation") or {}
            if isinstance(history_system_account, dict):
                history_system_account["isActive"] = False
                history_student_payload["systemAccountInformation"] = history_system_account

            history_parent_guardian = history_student_payload.get("parentGuardianInformation") or {}
            history_parent_rows = history_parent_guardian.get("parents")
            if isinstance(history_parent_rows, list):
                for parent_row in history_parent_rows:
                    if not isinstance(parent_row, dict):
                        continue
                    account_info = parent_row.get("systemAccountInformation") or {}
                    if isinstance(account_info, dict):
                        account_info["isActive"] = "false"
                        parent_row["systemAccountInformation"] = account_info
            history_student_payload["parentGuardianInformation"] = history_parent_guardian

            history_student_root = f"{history_root}/Students/{student_id}"
            root_updates[history_student_root] = {
                **history_student_payload,
                "academicYear": normalized_current_year,
                "grade": current_grade_text,
                "section": current_section,
                "status": archive_status,
                "updatedAt": now_iso,
                "basicStudentInformation": history_basic,
                "records": history_records,
                "rolloverSummary": {
                    "fromAcademicYear": normalized_current_year,
                    "toAcademicYear": target_year,
                    "grade": current_grade_num if current_grade_num is not None else current_grade_text,
                    "outcome": archive_status,
                    "promotedToGrade": normalize_score(promoted_to) if safe_number(promoted_to) is not None else promoted_to,
                    "results": final_results,
                    "attendance": attendance_summary,
                    "rolledOverAt": now_iso,
                },
                "rollover": {
                    "fromAcademicYear": normalized_current_year,
                    "toAcademicYear": target_year,
                    "rolledOverAt": now_iso,
                    "outcome": archive_status,
                    "promotedToGrade": normalize_score(promoted_to) if safe_number(promoted_to) is not None else promoted_to,
                },
            }
            students_archived += 1

        root_updates[f"AcademicYears/{normalized_current_year}"] = {
            **current_year_node,
            "yearKey": normalized_current_year,
            "label": current_year_label,
            "status": "completed",
            "isCurrent": False,
            "updatedAt": now_iso,
        }

        target_year_existing = (years or {}).get(target_year) or {}
        root_updates[f"AcademicYears/{target_year}"] = {
            **target_year_existing,
            "yearKey": target_year,
            "label": first_non_empty(target_year_existing.get("label"), year_label_from_key(target_year)),
            "status": "active",
            "isCurrent": True,
            "createdAt": target_year_existing.get("createdAt") or now_iso,
            "updatedAt": now_iso,
        }

        for year_key, year_row in (years or {}).items():
            if year_key in {normalized_current_year, target_year}:
                continue
            if (year_row or {}).get("isCurrent"):
                root_updates[f"AcademicYears/{year_key}/isCurrent"] = False

        root_updates["schoolInfo/currentAcademicYear"] = target_year
        root_updates[f"{history_root}/rolloverMeta"] = {
            "fromAcademicYear": normalized_current_year,
            "toAcademicYear": target_year,
            "promotionPassMark": normalize_score(promotion_pass_mark),
            "studentsArchived": students_archived,
            "movedStudents": students_archived,
            "movedParents": len(parents or {}),
            "promoted": promoted,
            "repeated": repeated,
            "graduated": graduated,
            "withdrawn": withdrawn,
            "resetYearlyData": reset_yearly_data,
            "rolledOverAt": now_iso,
        }

        root_updates["Students"] = {}
        root_updates["Parents"] = {}
        root_updates["ClassMarks"] = {}
        root_updates["LessonPlans"] = {}
        root_updates["AssesmentTemplates"] = {}
        root_updates["AssessmentTemplates"] = {}

        for user_id in deactivated_user_ids:
            if not user_id:
                continue
            root_updates[f"Users/{user_id}/isActive"] = False

        school_ref(school_code).update(root_updates)

        cleared_nodes = []
        if reset_yearly_data:
            grade_management_current = clone_json((school_node or {}).get("GradeManagement") or {})
            grades_map = (grade_management_current or {}).get("grades")
            if isinstance(grades_map, dict):
                for grade_row in grades_map.values():
                    if isinstance(grade_row, dict):
                        grade_row["sectionSubjectTeachers"] = {}

            school_exams_current = clone_json((school_node or {}).get("SchoolExams") or {})
            if isinstance(school_exams_current, dict):
                for child_key in school_exam_reset_keys:
                    school_exams_current[child_key] = {}

            school_ref(school_code).update({
                "Chats": {},
                "Attendance": {},
                "SchoolExams": school_exams_current,
                "Employees_Attendance": {},
                "CalendarEvents": {},
                "StudentBookNotes": {},
                "Schedules": {},
                "GradeManagement": grade_management_current,
            })
            cleared_nodes = cleared_nodes_template

        rollover_history_ref(school_code).child(request_id).update({
            "status": "executed",
            "executedAt": now_iso,
            "result": {
                "fromAcademicYear": normalized_current_year,
                "toAcademicYear": target_year,
                "promoted": promoted,
                "repeated": repeated,
                "graduated": graduated,
                "withdrawn": withdrawn,
                "studentsArchived": students_archived,
                "deactivatedUsers": len(deactivated_user_ids),
            },
        })
        pending_rollover_ref(school_code).delete()

        return jsonify({
            "success": True,
            "message": f"Rollover completed to {year_label_from_key(target_year)}.",
            "fromYear": normalized_current_year,
            "toYear": target_year,
            "promoted": promoted,
            "repeated": repeated,
            "graduated": graduated,
            "withdrawn": withdrawn,
            "studentsArchived": students_archived,
            "deactivatedUsers": len(deactivated_user_ids),
            "resetSummary": {
                "clearedNodes": cleared_nodes,
                "archivePath": f"YearHistory/{normalized_current_year}",
            },
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True, use_reloader=False)
