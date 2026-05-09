import json
import os
import re
from datetime import datetime, timedelta, timezone
from time import time
from urllib.parse import unquote, urlparse
from flask import Flask, g, jsonify, render_template, request, session, has_request_context
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from firebase_config import get_firebase_options, require_firebase_credentials
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash


APP_ENV = str(os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").strip().lower()
DEFAULT_ALLOWED_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
)
DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60
TEACHER_SESSION_KEY = "teacher_auth"
PUBLIC_API_EXACT_PATHS = {
    "/api/health",
    "/api/schools",
    "/api/teacher_login",
    "/api/teacher/logout",
}


def _env_flag(name, default=False):
    raw_value = os.getenv(name)
    if raw_value is None:
        return bool(default)

    return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}


def _parse_allowed_origins():
    raw_origins = str(os.getenv("ALLOWED_ORIGINS") or "").strip()
    if raw_origins:
        parsed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
        if parsed_origins:
            return parsed_origins

    return list(DEFAULT_ALLOWED_ORIGINS)


def _read_runtime_secret_key():
    secret_key = str(os.getenv("FLASK_SECRET_KEY") or os.getenv("APP_SECRET_KEY") or "").strip()
    if secret_key:
        return secret_key

    if APP_ENV == "production":
        raise RuntimeError("FLASK_SECRET_KEY or APP_SECRET_KEY must be set in production.")

    return "gojo-teacher-dev-session-secret"


def _read_session_ttl_seconds():
    raw_value = str(os.getenv("TEACHER_SESSION_TTL_SECONDS") or "").strip()
    if not raw_value:
        return DEFAULT_SESSION_TTL_SECONDS

    try:
        parsed_value = int(raw_value)
    except (TypeError, ValueError):
        return DEFAULT_SESSION_TTL_SECONDS

    return parsed_value if parsed_value > 0 else DEFAULT_SESSION_TTL_SECONDS


def _read_session_cookie_samesite():
    normalized_value = str(os.getenv("SESSION_COOKIE_SAMESITE") or "Lax").strip().title()
    return normalized_value if normalized_value in {"Lax", "Strict", "None"} else "Lax"


def _is_public_api_request(path):
    normalized_path = f"/{str(path or '').strip().lstrip('/')}"
    normalized_path = normalized_path.rstrip("/") or "/"
    if normalized_path in PUBLIC_API_EXACT_PATHS:
        return True

    return normalized_path.startswith("/api/schools/") and normalized_path.endswith("/grades")

# ---------------- FLASK APP ----------------
app = Flask(__name__)
app.config.update(
    JSON_SORT_KEYS=False,
    SECRET_KEY=_read_runtime_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE=_read_session_cookie_samesite(),
    SESSION_COOKIE_SECURE=_env_flag("SESSION_COOKIE_SECURE", APP_ENV == "production"),
    PERMANENT_SESSION_LIFETIME=timedelta(seconds=_read_session_ttl_seconds()),
)
CORS(app, resources={r"/*": {"origins": _parse_allowed_origins()}}, supports_credentials=True)

# ---------------- FIREBASE ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
firebase_credentials = require_firebase_credentials()
cred = credentials.Certificate(firebase_credentials)
firebase_admin.initialize_app(cred, get_firebase_options())

_raw_db_reference = db.reference

SCOPED_ROOTS = {
    "Users",
    "Students",
    "Parents",
    "Teachers",
    "School_Admins",
    "TeacherAssignments",
    "Courses",
    "ClassMarks",
    "Posts",
    "TeacherPosts",
    "Chats",
    "Chat_Summaries",
    "StudentNotes",
    "LessonPlans",
    "LessonPlanSubmissions",
    "AcademicYears",
    "AssessmentTemplates",
    "Presence",
    "Curriculum",
    "Exams",
    "SchoolExams",
    "counters",
    "Users_counters",
}

TEACHER_PROXY_WRITE_PREFIXES = (
    "Chats",
    "Chat_Summaries",
    "TeacherPosts",
    "LessonPlans",
    "LessonPlanSubmissions",
    "SchoolExams",
)

COURSE_STUDENTS_CACHE_TTL_SECONDS = 5 * 60
STUDENT_ROSTER_CACHE_TTL_SECONDS = 60 * 60
MIN_TEACHER_PASSWORD_LENGTH = 8
student_grade_cache = {}
parent_lookup_cache = {}


def _utc_now():
    return datetime.now(timezone.utc)


def _utc_now_isoformat():
    return _utc_now().isoformat()


def _utc_timestamp():
    return int(_utc_now().timestamp())


def _normalize_password_value(value):
    return str(value or "")


def _looks_like_password_hash(value):
    normalized = _normalize_password_value(value).strip()
    return normalized.startswith(("pbkdf2:", "scrypt:", "argon2:"))


def _password_meets_teacher_requirements(password):
    normalized_password = _normalize_password_value(password)
    return (
        len(normalized_password) >= MIN_TEACHER_PASSWORD_LENGTH
        and bool(re.search(r"[A-Za-z]", normalized_password))
        and bool(re.search(r"[0-9]", normalized_password))
    )


def _build_password_hash(password):
    return generate_password_hash(_normalize_password_value(password))


def _verify_password_record(user_record, candidate_password):
    normalized_candidate = _normalize_password_value(candidate_password)
    if not isinstance(user_record, dict) or not normalized_candidate:
        return False, False

    checked_hashes = set()
    for stored_value in (
        _normalize_password_value(user_record.get("passwordHash")).strip(),
        _normalize_password_value(user_record.get("password")).strip(),
    ):
        if not stored_value or stored_value in checked_hashes or not _looks_like_password_hash(stored_value):
            continue

        checked_hashes.add(stored_value)
        try:
            if check_password_hash(stored_value, normalized_candidate):
                return True, False
        except ValueError:
            continue

    legacy_password = _normalize_password_value(user_record.get("password"))
    if legacy_password and legacy_password == normalized_candidate:
        return True, True

    return False, False


def _write_user_password_hash(users_ref, user_node_key, plain_password):
    normalized_user_key = str(user_node_key or "").strip()
    if not normalized_user_key:
        return ""

    password_updated_at = _utc_now_isoformat()
    password_hash = _build_password_hash(plain_password)
    user_ref = users_ref.child(normalized_user_key)
    user_ref.update({
        "passwordHash": password_hash,
        "passwordUpdatedAt": password_updated_at,
    })

    try:
        user_ref.child("password").delete()
    except Exception:
        user_ref.update({"password": None})

    return password_updated_at


def _is_teacher_user_record(user_record):
    if not isinstance(user_record, dict):
        return False

    normalized_role = str(user_record.get("role") or "").strip().lower()
    return normalized_role in {"", "teacher"}


def _verify_teacher_user_credentials(users_ref, user_node_key, raw_password, expected_username=None):
    normalized_user_key = str(user_node_key or "").strip()
    normalized_password = _normalize_password_value(raw_password)
    normalized_expected_username = str(expected_username or "").strip().upper()

    if not normalized_user_key or not normalized_password:
        return False, {}, "Username and password required"

    user_record = users_ref.child(normalized_user_key).get() or {}
    if not isinstance(user_record, dict) or not user_record or not _is_teacher_user_record(user_record):
        return False, {}, "Teacher account not found"

    if normalized_expected_username:
        stored_username = str(user_record.get("username") or "").strip().upper()
        if stored_username != normalized_expected_username:
            return False, user_record, "Teacher username does not match this account"

    password_matches, needs_upgrade = _verify_password_record(user_record, normalized_password)
    if not password_matches:
        return False, user_record, "Invalid password"

    if needs_upgrade:
        password_updated_at = _write_user_password_hash(users_ref, normalized_user_key, normalized_password)
        user_record = {
            **user_record,
            "passwordHash": "configured",
            "passwordUpdatedAt": password_updated_at,
        }
        user_record.pop("password", None)

    return True, user_record, ""


def _normalize_session_identifier(value):
    return str(value or "").strip()


def _clear_teacher_session():
    if not has_request_context():
        return

    session.pop(TEACHER_SESSION_KEY, None)
    g.teacher_session = {}
    g.teacher_session_loaded = True


def _write_teacher_session(payload):
    teacher_key = _normalize_session_identifier(payload.get("teacherKey") or payload.get("teacherId"))
    teacher_id = _normalize_session_identifier(payload.get("teacherId") or teacher_key)
    teacher_session = {
        "teacherKey": teacher_key,
        "teacherId": teacher_id,
        "userId": _normalize_session_identifier(payload.get("userId")),
        "username": _normalize_session_identifier(payload.get("username")),
        "schoolCode": _normalize_session_identifier(payload.get("schoolCode")),
        "name": _normalize_session_identifier(payload.get("name")),
    }

    session[TEACHER_SESSION_KEY] = teacher_session
    session.permanent = True
    g.teacher_session = teacher_session
    g.teacher_session_loaded = True
    return teacher_session


def _get_teacher_session():
    if not has_request_context():
        return {}

    if getattr(g, "teacher_session_loaded", False):
        return getattr(g, "teacher_session", {}) or {}

    raw_session = session.get(TEACHER_SESSION_KEY) or {}
    if not isinstance(raw_session, dict):
        _clear_teacher_session()
        return {}

    teacher_session = {
        "teacherKey": _normalize_session_identifier(raw_session.get("teacherKey") or raw_session.get("teacherId")),
        "teacherId": _normalize_session_identifier(raw_session.get("teacherId") or raw_session.get("teacherKey")),
        "userId": _normalize_session_identifier(raw_session.get("userId")),
        "username": _normalize_session_identifier(raw_session.get("username")),
        "schoolCode": _normalize_session_identifier(raw_session.get("schoolCode")),
        "name": _normalize_session_identifier(raw_session.get("name")),
    }

    if not teacher_session["teacherKey"] or not teacher_session["userId"] or not teacher_session["schoolCode"]:
        _clear_teacher_session()
        return {}

    g.teacher_session = teacher_session
    g.teacher_session_loaded = True
    return teacher_session


def _teacher_session_matches(teacher_session, *, school_code=None, user_id=None, teacher_key=None, username=None):
    if not teacher_session:
        return False

    normalized_school_code = _normalize_session_identifier(school_code)
    normalized_user_id = _normalize_session_identifier(user_id)
    normalized_teacher_key = _normalize_session_identifier(teacher_key).upper()
    normalized_username = _normalize_session_identifier(username).upper()

    if normalized_school_code:
        session_school = _resolve_requested_school_code(teacher_session.get("schoolCode"))
        requested_school = _resolve_requested_school_code(normalized_school_code)
        if session_school != requested_school:
            return False

    if normalized_user_id and teacher_session.get("userId") != normalized_user_id:
        return False

    if normalized_teacher_key:
        session_teacher_keys = {
            _normalize_session_identifier(teacher_session.get("teacherKey")).upper(),
            _normalize_session_identifier(teacher_session.get("teacherId")).upper(),
        }
        if normalized_teacher_key not in session_teacher_keys:
            return False

    if normalized_username and _normalize_session_identifier(teacher_session.get("username")).upper() != normalized_username:
        return False

    return True


def _enforce_current_teacher_scope(*, school_code=None, user_id=None, teacher_key=None, username=None, message=None):
    if _teacher_session_matches(
        _get_teacher_session(),
        school_code=school_code,
        user_id=user_id,
        teacher_key=teacher_key,
        username=username,
    ):
        return None

    return jsonify({
        "success": False,
        "message": message or "This route is limited to the signed-in teacher.",
    }), 403


def _read_explicit_school_code_from_request():
    if not has_request_context():
        return str(os.getenv("DEFAULT_SCHOOL_CODE", "")).strip()

    school_code = (
        request.args.get("schoolCode")
        or request.headers.get("X-School-Code")
        or request.headers.get("x-school-code")
    )

    if not school_code:
        body = request.get_json(silent=True) or {}
        school_code = body.get("schoolCode")

    if not school_code:
        school_code = request.form.get("schoolCode")

    return str(school_code or "").strip()


def _read_school_code_from_request():
    if not has_request_context():
        return str(os.getenv("DEFAULT_SCHOOL_CODE", "")).strip()

    school_code = _read_explicit_school_code_from_request()
    if not school_code:
        school_code = _get_teacher_session().get("schoolCode")

    if not school_code:
        school_code = os.getenv("DEFAULT_SCHOOL_CODE", "")

    return str(school_code or "").strip()


def school_reference(path, school_code=None):
    normalized = str(path or "").strip().lstrip("/")
    if not normalized:
        return _raw_db_reference("")

    if normalized.startswith("Platform1/Schools/"):
        return _raw_db_reference(normalized)

    root = normalized.split("/", 1)[0]
    resolved_school = str(school_code or _read_school_code_from_request() or "").strip()

    if resolved_school and not resolved_school.startswith("ET-"):
        mapped_school = _resolve_school_code_by_short_name(resolved_school)
        if mapped_school:
            resolved_school = mapped_school

    if root in SCOPED_ROOTS and resolved_school:
        normalized = f"Platform1/Schools/{resolved_school}/{normalized}"

    return _raw_db_reference(normalized)


def _resolve_requested_school_code(explicit_school_code=None):
    resolved_school = str(explicit_school_code or _read_school_code_from_request() or "").strip()

    if resolved_school and not resolved_school.startswith("ET-"):
        mapped_school = _resolve_school_code_by_short_name(resolved_school)
        if mapped_school:
            resolved_school = mapped_school

    return resolved_school


@app.before_request
def require_teacher_api_session():
    if request.method == "OPTIONS" or not request.path.startswith("/api"):
        return None

    if _is_public_api_request(request.path):
        return None

    teacher_session = _get_teacher_session()
    if not teacher_session:
        return jsonify({
            "success": False,
            "message": "Teacher session required. Please sign in again.",
            "errorCode": "teacher_session_required",
        }), 401

    explicit_school_code = _read_explicit_school_code_from_request()
    if explicit_school_code and not _teacher_session_matches(
        teacher_session,
        school_code=explicit_school_code,
    ):
        return jsonify({
            "success": False,
            "message": "This request is outside the current teacher school scope.",
            "errorCode": "teacher_session_scope_violation",
        }), 403

    return None


def _read_student_grade(student_record):
    if not isinstance(student_record, dict):
        return ""

    return str(
        student_record.get("grade")
        or (student_record.get("basicStudentInformation") or {}).get("grade")
        or (student_record.get("academicSetup") or {}).get("grade")
        or ""
    ).strip()


def _read_student_section(student_record):
    if not isinstance(student_record, dict):
        return ""

    return str(
        student_record.get("section")
        or (student_record.get("basicStudentInformation") or {}).get("section")
        or (student_record.get("academicSetup") or {}).get("section")
        or ""
    ).strip().upper()


def _read_student_user_id(student_record):
    if not isinstance(student_record, dict):
        return ""

    return str(
        student_record.get("userId")
        or (student_record.get("systemAccountInformation") or {}).get("userId")
        or (student_record.get("account") or {}).get("userId")
        or ""
    ).strip()


def _is_active_record(record):
    if not isinstance(record, dict):
        return False

    raw_value = record.get("status")
    if raw_value is None:
        raw_value = record.get("isActive")

    if isinstance(raw_value, bool):
        return raw_value

    normalized_value = str(raw_value or "active").strip().lower()
    return normalized_value in {"active", "true", "1"}


def _cache_get(cache_store, cache_key, ttl_seconds):
    cache_entry = cache_store.get(cache_key)
    if not cache_entry:
        return None

    if time() - float(cache_entry.get("cached_at") or 0) > float(ttl_seconds or 0):
        cache_store.pop(cache_key, None)
        return None

    return cache_entry.get("value")


def _cache_set(cache_store, cache_key, value):
    cache_store[cache_key] = {
        "value": value,
        "cached_at": time(),
    }
    return value


def _first_snapshot_record(snapshot):
    if isinstance(snapshot, dict):
        for record_key, record_value in snapshot.items():
            if isinstance(record_value, dict):
                return str(record_key or "").strip(), record_value

    return "", {}


def _build_student_roster_cache_key(school_code):
    return str(school_code or "__default__").strip() or "__default__"


def _clear_student_roster_cache(school_code):
    student_grade_cache.pop(_build_student_roster_cache_key(school_code), None)


def _get_cached_student_grade_sections(school_code):
    cache_key = _build_student_roster_cache_key(school_code)
    cached_value = _cache_get(student_grade_cache, cache_key, STUDENT_ROSTER_CACHE_TTL_SECONDS)
    if isinstance(cached_value, dict):
        return cached_value

    students_node = school_reference("Students", school_code=school_code).get() or {}
    if not isinstance(students_node, dict):
        students_node = {}

    grade_section_index = {}
    for student_key, student_record in students_node.items():
        if not isinstance(student_record, dict):
            continue

        grade_section_key = f"{_read_student_grade(student_record)}|{_read_student_section(student_record)}"
        if grade_section_key == "|":
            continue

        grade_section_index.setdefault(grade_section_key, {})[str(student_key or "").strip()] = student_record

    return _cache_set(student_grade_cache, cache_key, grade_section_index)


def _load_students_for_grade_sections(school_code, allowed_grade_sections, include_inactive=False):
    normalized_allowed = {
        str(value or "").strip()
        for value in (allowed_grade_sections or set())
        if str(value or "").strip()
    }
    if not school_code or not normalized_allowed:
        return []

    grade_section_index = _get_cached_student_grade_sections(school_code)
    user_cache = {}
    rows = []
    seen_student_keys = set()

    for grade_section_key in normalized_allowed:
        for student_key, student_record in (grade_section_index.get(grade_section_key) or {}).items():
            if not isinstance(student_record, dict):
                continue

            normalized_student_key = str(student_key or "").strip()
            if not normalized_student_key or normalized_student_key in seen_student_keys:
                continue

            student_user_id = _read_student_user_id(student_record)
            if not student_user_id:
                continue

            if not include_inactive and not _is_active_record(student_record):
                continue

            student_section = _read_student_section(student_record)

            if student_user_id not in user_cache:
                user_record = school_reference(f"Users/{student_user_id}", school_code=school_code).get() or {}
                user_cache[student_user_id] = user_record if isinstance(user_record, dict) else {}

            seen_student_keys.add(normalized_student_key)
            rows.append({
                "studentKey": normalized_student_key,
                "studentId": str(student_record.get("studentId") or student_key or "").strip(),
                "userId": student_user_id,
                "grade": _read_student_grade(student_record),
                "section": student_section,
                "raw": student_record,
                "user": user_cache.get(student_user_id) or {},
            })

    return rows


def _load_parent_record_by_identifier(school_code, parent_identifier):
    normalized_identifier = str(parent_identifier or "").strip()
    if not school_code or not normalized_identifier:
        return "", {}

    cache_key = f"{str(school_code or '__default__').strip() or '__default__'}::{normalized_identifier}"
    cached_value = _cache_get(parent_lookup_cache, cache_key, COURSE_STUDENTS_CACHE_TTL_SECONDS)
    if isinstance(cached_value, dict):
        record_key = str(cached_value.get("recordKey") or "").strip()
        record = cached_value.get("record") or {}
        return record_key, record if isinstance(record, dict) else {}

    parents_ref = school_reference("Parents", school_code=school_code)
    direct_record = parents_ref.child(normalized_identifier).get() or {}
    if isinstance(direct_record, dict) and direct_record:
        enriched_direct_record = {
            **direct_record,
            "parentId": str(direct_record.get("parentId") or normalized_identifier).strip(),
        }
        payload = {
            "recordKey": normalized_identifier,
            "record": enriched_direct_record,
        }
        _cache_set(parent_lookup_cache, cache_key, payload)
        return normalized_identifier, enriched_direct_record

    try:
        record_key, record = _first_snapshot_record(
            parents_ref.order_by_child("userId").equal_to(normalized_identifier).limit_to_first(1).get() or {}
        )
    except Exception:
        record_key, record = "", {}

    if not isinstance(record, dict) or not record:
        return "", {}

    enriched_record = {
        **record,
        "parentId": str(record.get("parentId") or record_key or normalized_identifier).strip(),
    }
    payload = {
        "recordKey": record_key,
        "record": enriched_record,
    }
    _cache_set(parent_lookup_cache, cache_key, payload)
    if record_key:
        _cache_set(
            parent_lookup_cache,
            f"{str(school_code or '__default__').strip() or '__default__'}::{record_key}",
            payload,
        )
    parent_user_id = str(enriched_record.get("userId") or "").strip()
    if parent_user_id:
        _cache_set(
            parent_lookup_cache,
            f"{str(school_code or '__default__').strip() or '__default__'}::{parent_user_id}",
            payload,
        )

    return record_key, enriched_record


def _normalize_rtdb_proxy_path(path_value):
    normalized = str(path_value or "").strip().lstrip("/")
    if normalized.endswith(".json"):
        normalized = normalized[:-5]
    return normalized.strip("/")


def _parse_rtdb_query_value(raw_value):
    if raw_value is None:
        return None

    normalized = str(raw_value or "").strip()
    if not normalized:
        return None

    try:
        return json.loads(normalized)
    except Exception:
        return normalized


def _apply_rtdb_proxy_query(reference):
    order_by = request.args.get("orderBy")
    if order_by is not None:
        normalized_order_by = _parse_rtdb_query_value(order_by)
        if normalized_order_by == "$key":
            reference = reference.order_by_key()
        elif normalized_order_by == "$value":
            reference = reference.order_by_value()
        elif normalized_order_by:
            reference = reference.order_by_child(str(normalized_order_by))

    if request.args.get("startAt") is not None:
        reference = reference.start_at(_parse_rtdb_query_value(request.args.get("startAt")))

    if request.args.get("endAt") is not None:
        reference = reference.end_at(_parse_rtdb_query_value(request.args.get("endAt")))

    if request.args.get("equalTo") is not None:
        reference = reference.equal_to(_parse_rtdb_query_value(request.args.get("equalTo")))

    if request.args.get("limitToFirst") is not None:
        try:
            reference = reference.limit_to_first(int(str(request.args.get("limitToFirst") or "0")))
        except (TypeError, ValueError):
            pass

    if request.args.get("limitToLast") is not None:
        try:
            reference = reference.limit_to_last(int(str(request.args.get("limitToLast") or "0")))
        except (TypeError, ValueError):
            pass

    return reference


def _is_allowed_teacher_proxy_path(node_path, teacher_session):
    normalized_path = str(node_path or "").strip().lstrip("/")
    if not normalized_path or not teacher_session:
        return False

    normalized_school_code = _resolve_requested_school_code(teacher_session.get("schoolCode"))

    if normalized_path.startswith("Platform1/schoolCodeIndex/"):
        return request.method == "GET"

    relative_path = _extract_teacher_proxy_relative_path(normalized_path, normalized_school_code)
    if not relative_path:
        return False

    if request.method == "GET":
        return relative_path.split("/", 1)[0] in SCOPED_ROOTS

    return _is_allowed_teacher_proxy_write_path(relative_path)


def _extract_teacher_proxy_relative_path(node_path, school_code=""):
    normalized_path = _normalize_rtdb_proxy_path(node_path)
    normalized_school_code = _resolve_requested_school_code(school_code)
    if not normalized_path:
        return ""

    if not normalized_path.startswith("Platform1/Schools/"):
        return normalized_path

    path_segments = normalized_path.split("/")
    if len(path_segments) < 4:
        return ""

    if normalized_school_code and path_segments[2] != normalized_school_code:
        return ""

    return "/".join(path_segments[3:])


def _path_matches_prefix(path_value, prefix):
    normalized_path = _normalize_rtdb_proxy_path(path_value)
    normalized_prefix = _normalize_rtdb_proxy_path(prefix)
    if not normalized_path or not normalized_prefix:
        return False

    return normalized_path == normalized_prefix or normalized_path.startswith(f"{normalized_prefix}/")


def _is_allowed_teacher_proxy_write_path(relative_path):
    normalized_relative_path = _normalize_rtdb_proxy_path(relative_path)
    if not normalized_relative_path:
        return False

    if any(_path_matches_prefix(normalized_relative_path, prefix) for prefix in TEACHER_PROXY_WRITE_PREFIXES):
        return True

    if _path_matches_prefix(normalized_relative_path, "AcademicYears"):
        return "/LessonPlans/" in f"/{normalized_relative_path}/"

    return False


@app.route("/api/rtdb-proxy/<path:node_path>", methods=["GET", "PUT", "PATCH", "POST", "DELETE"])
def rtdb_proxy(node_path):
    normalized_path = _normalize_rtdb_proxy_path(node_path)
    if not normalized_path:
        return jsonify({"success": False, "message": "RTDB path is required"}), 400

    teacher_session = _get_teacher_session()
    if not _is_allowed_teacher_proxy_path(normalized_path, teacher_session):
        return jsonify({
            "success": False,
            "message": "This RTDB path is not available for the current teacher session.",
        }), 403

    try:
        reference = school_reference(normalized_path)
        raw_body = request.get_data(cache=True, as_text=True)

        if request.method == "GET":
            queried_reference = _apply_rtdb_proxy_query(reference)
            return jsonify(queried_reference.get())

        if request.method == "DELETE":
            reference.delete()
            return jsonify(None)

        payload = request.get_json(silent=True)

        if request.method == "PUT":
            if str(raw_body or "").strip().lower() == "null":
                reference.delete()
                return jsonify(None)

            if payload is None and str(raw_body or "").strip():
                return jsonify({"success": False, "message": "Invalid JSON payload"}), 400

            reference.set(payload)
            return jsonify(payload)

        if request.method == "PATCH":
            if not isinstance(payload, dict):
                return jsonify({"success": False, "message": "PATCH payload must be a JSON object"}), 400
            reference.update(payload)
            return jsonify(payload)

        new_ref = reference.push(payload)
        return jsonify({"name": new_ref.key}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


def _normalize_short_name(value):
    return "".join(ch for ch in str(value or "").upper() if ch.isalnum())


def _normalize_course_fragment(value):
    cleaned = "".join(
        ch.lower() if ch.isalnum() else "_"
        for ch in str(value or "").strip()
    )
    return "_".join(part for part in cleaned.split("_") if part)


def _normalize_teacher_ref(value):
    return str(value or "").strip().lstrip("-").upper()


def _course_matches(course_data, grade, section, subject):
    course_grade = str(course_data.get("grade") or "").strip()
    course_section = str(course_data.get("section") or course_data.get("secation") or "").strip().upper()
    course_subject = _normalize_course_fragment(course_data.get("subject") or course_data.get("name") or "")
    return (
        course_grade == str(grade or "").strip()
        and course_section == str(section or "").strip().upper()
        and course_subject == _normalize_course_fragment(subject)
    )


def _lesson_plan_week_key(week):
    return f"week_{str(week)}"


def _lesson_plan_normalize_annual_rows(rows):
    if not isinstance(rows, list):
        return []
    normalized = []
    for row in rows:
        if isinstance(row, dict):
            normalized.append(row)
    return normalized


def _lesson_plan_extract_weeks_from_course_node(course_node):
    weeks_node = course_node.get('weeks') if isinstance(course_node, dict) else {}
    if not isinstance(weeks_node, dict):
        weeks_node = {}

    legacy_week_nodes = {}
    if isinstance(course_node, dict):
        legacy_week_nodes = {
            key: value
            for key, value in course_node.items()
            if str(key).startswith('week_') and isinstance(value, dict)
        }

    return weeks_node or legacy_week_nodes


def _lesson_plan_normalize_course_node(course_node, teacher_id, course_id, academic_year):
    if not isinstance(course_node, dict):
        course_node = {}

    meta = course_node.get('meta') if isinstance(course_node.get('meta'), dict) else {}
    annual_node = course_node.get('annual') if isinstance(course_node.get('annual'), dict) else {}
    weeks_node = _lesson_plan_extract_weeks_from_course_node(course_node)

    annual_rows = (
        annual_node.get('rows')
        or annual_node.get('annualRows')
        or course_node.get('annualRows')
        or []
    )
    annual_rows = _lesson_plan_normalize_annual_rows(annual_rows)

    normalized_meta = {
        **meta,
        'teacherId': meta.get('teacherId') or course_node.get('teacherId') or teacher_id,
        'courseId': meta.get('courseId') or course_node.get('courseId') or course_id,
        'academicYear': meta.get('academicYear') or course_node.get('academicYear') or academic_year,
        'updatedAt': meta.get('updatedAt') or annual_node.get('updatedAt') or course_node.get('updatedAt'),
    }

    normalized_annual = {
        **annual_node,
        'teacherId': annual_node.get('teacherId') or normalized_meta['teacherId'],
        'courseId': annual_node.get('courseId') or normalized_meta['courseId'],
        'academicYear': annual_node.get('academicYear') or normalized_meta['academicYear'],
        'rows': annual_rows,
        'annualRows': annual_rows,
        'rowCount': len(annual_rows),
        'updatedAt': annual_node.get('updatedAt') or normalized_meta.get('updatedAt'),
    }

    normalized = {
        'teacherId': normalized_meta['teacherId'],
        'courseId': normalized_meta['courseId'],
        'academicYear': normalized_meta['academicYear'],
        'updatedAt': normalized_meta.get('updatedAt'),
        'meta': normalized_meta,
        'annual': normalized_annual,
        'annualRows': annual_rows,
        'weeks': weeks_node,
    }

    for week_key, week_value in weeks_node.items():
        normalized[week_key] = week_value

    return normalized


def _lesson_plan_migrate_course_node(course_ref, course_node, teacher_id, course_id, academic_year):
    normalized = _lesson_plan_normalize_course_node(course_node, teacher_id, course_id, academic_year)
    mutated = False

    if not isinstance(course_node, dict):
        course_node = {}

    stored_weeks = course_node.get('weeks') if isinstance(course_node.get('weeks'), dict) else {}
    normalized_weeks = normalized.get('weeks') or {}
    if normalized_weeks and stored_weeks != normalized_weeks:
        course_ref.child('weeks').set(normalized_weeks)
        mutated = True

    stored_annual = course_node.get('annual') if isinstance(course_node.get('annual'), dict) else {}
    normalized_annual = normalized.get('annual') or {}
    if normalized_annual and stored_annual != normalized_annual:
        course_ref.child('annual').set(normalized_annual)
        mutated = True

    stored_meta = course_node.get('meta') if isinstance(course_node.get('meta'), dict) else {}
    normalized_meta = normalized.get('meta') or {}
    if normalized_meta and stored_meta != normalized_meta:
        course_ref.child('meta').set(normalized_meta)
        mutated = True

    legacy_week_keys = [
        key for key, value in course_node.items()
        if str(key).startswith('week_') and isinstance(value, dict)
    ] if isinstance(course_node, dict) else []
    for legacy_week_key in legacy_week_keys:
        course_ref.child(legacy_week_key).delete()
        mutated = True

    if isinstance(course_node, dict) and 'annualRows' in course_node:
        course_ref.child('annualRows').delete()
        mutated = True

    return normalized, mutated


def _lesson_plan_migrate_submission_entries(base_ref, raw_data, teacher_id, course_id, academic_year):
    if not isinstance(raw_data, dict):
        raw_data = {}

    entries_node = raw_data.get('entries') if isinstance(raw_data.get('entries'), dict) else {}
    meta_node = raw_data.get('meta') if isinstance(raw_data.get('meta'), dict) else {}

    legacy_entries = {
        key: value
        for key, value in raw_data.items()
        if key not in {'entries', 'meta'} and isinstance(value, dict)
    }

    normalized_entries = entries_node or legacy_entries
    mutated = False

    if normalized_entries and entries_node != normalized_entries:
        base_ref.child('entries').set(normalized_entries)
        mutated = True

    normalized_meta = {
        **meta_node,
        'teacherId': meta_node.get('teacherId') or teacher_id,
        'courseId': meta_node.get('courseId') or course_id,
        'academicYear': meta_node.get('academicYear') or academic_year,
        'updatedAt': meta_node.get('updatedAt') or _utc_now_isoformat(),
    }
    if normalized_entries and meta_node != normalized_meta:
        base_ref.child('meta').set(normalized_meta)
        mutated = True

    for legacy_key in legacy_entries.keys():
        base_ref.child(legacy_key).delete()
        mutated = True

    return normalized_entries, mutated


def _build_virtual_course_id(grade, section, subject):
    normalized_subject = _normalize_course_fragment(subject)
    return f"course_{normalized_subject}_{str(grade or '').strip()}{str(section or '').strip().upper()}"


def _humanize_course_subject(value):
    words = [part for part in _normalize_course_fragment(value).split("_") if part]
    if not words:
        return ""
    return " ".join(word.capitalize() for word in words)


def _parse_course_defaults(course_id):
    normalized = str(course_id or "").strip()
    if not normalized.startswith("course_"):
        return {}

    body = normalized[len("course_"):]
    parts = [part for part in body.split("_") if part]
    if len(parts) < 2:
        return {}

    grade_section = parts[-1]
    match = re.match(r"^(\d+)([A-Za-z].*)$", grade_section)
    if not match:
        return {}

    subject_fragment = "_".join(parts[:-1])
    return {
        "subject": _humanize_course_subject(subject_fragment),
        "name": _humanize_course_subject(subject_fragment),
        "grade": match.group(1),
        "section": match.group(2).upper(),
    }


def _resolve_course_id_from_grade_assignment(courses, grade, section, subject):
    fallback_id = _build_virtual_course_id(grade, section, subject)
    if not isinstance(courses, dict):
        return fallback_id

    if fallback_id in courses:
        return fallback_id

    for course_id, course_data in courses.items():
        if isinstance(course_data, dict) and _course_matches(course_data, grade, section, subject):
            return course_id

    return fallback_id


def _resolve_teacher_course_entries(school_code, teacher_identifiers=None, teacher_record_key=None):
    resolved_school = str(school_code or "").strip()
    if not resolved_school:
        return []

    normalized_identifiers = {
        _normalize_teacher_ref(value)
        for value in (teacher_identifiers or [])
        if str(value or "").strip()
    }
    if teacher_record_key:
        normalized_identifiers.add(_normalize_teacher_ref(teacher_record_key))

    courses = school_reference("Courses", resolved_school).get() or {}
    assignments = school_reference("TeacherAssignments", resolved_school).get() or {}
    entries = []
    seen = set()

    def add_entry(course_id, assignment=None):
        if not course_id or course_id in seen:
            return
        seen.add(course_id)

        course_data = courses.get(course_id) if isinstance(courses, dict) else None
        if isinstance(course_data, dict):
            merged = {
                "courseId": course_id,
                "subject": course_data.get("subject") or course_data.get("name") or "",
                "name": course_data.get("name") or course_data.get("subject") or "",
                "grade": course_data.get("grade") or "",
                "section": course_data.get("section") or course_data.get("secation") or "",
                "virtual": False,
            }
        else:
            defaults = _parse_course_defaults(course_id)
            merged = {
                "courseId": course_id,
                "subject": defaults.get("subject") or _humanize_course_subject((assignment or {}).get("subject") or course_id),
                "name": defaults.get("name") or _humanize_course_subject((assignment or {}).get("subject") or course_id),
                "grade": defaults.get("grade") or str((assignment or {}).get("grade") or ""),
                "section": defaults.get("section") or str((assignment or {}).get("section") or "").upper(),
                "virtual": True,
            }

        if assignment:
            merged["teacherId"] = assignment.get("teacherId") or assignment.get("teacherRecordKey")
        entries.append(merged)

    for assignment in assignments.values():
        if not isinstance(assignment, dict):
            continue
        assignment_teacher = _normalize_teacher_ref(assignment.get("teacherId"))
        if assignment_teacher in normalized_identifiers:
            course_id = str(assignment.get("courseId") or "").strip()
            add_entry(course_id, assignment)

    grade_management = _raw_db_reference(
        f"Platform1/Schools/{resolved_school}/GradeManagement/grades"
    ).get() or {}

    for grade_key, grade_data in grade_management.items():
        section_subject_teachers = (grade_data or {}).get("sectionSubjectTeachers") or {}
        for section_key, subject_map in section_subject_teachers.items():
            for subject_key, assignment in (subject_map or {}).items():
                if not isinstance(assignment, dict):
                    continue

                assignment_refs = {
                    _normalize_teacher_ref(assignment.get("teacherId")),
                    _normalize_teacher_ref(assignment.get("teacherRecordKey")),
                    _normalize_teacher_ref(assignment.get("teacherUserId")),
                    _normalize_teacher_ref(assignment.get("userId")),
                }

                if not assignment_refs.intersection(normalized_identifiers):
                    continue

                course_id = _resolve_course_id_from_grade_assignment(
                    courses,
                    grade_key,
                    assignment.get("section") or section_key,
                    assignment.get("subject") or subject_key,
                )
                add_entry(course_id, {
                    **assignment,
                    "grade": grade_key,
                    "section": assignment.get("section") or section_key,
                    "subject": assignment.get("subject") or subject_key,
                })

    return entries


def _resolve_teacher_course_ids(school_code, teacher_identifiers=None, teacher_record_key=None):
    return [entry.get("courseId") for entry in _resolve_teacher_course_entries(school_code, teacher_identifiers, teacher_record_key)]


def _extract_short_name_from_teacher_id(teacher_id):
    normalized = str(teacher_id or "").strip().upper()
    if not normalized:
        return ""

    first_token = normalized.split("_", 1)[0]
    letters_only = "".join(ch for ch in first_token if ch.isalpha())
    if letters_only.endswith("T") and len(letters_only) > 1:
        letters_only = letters_only[:-1]

    return _normalize_short_name(letters_only)


def _resolve_school_code_by_short_name(short_name):
    key = _normalize_short_name(short_name)
    if not key:
        return ""

    mapped = _raw_db_reference(f"Platform1/schoolCodeIndex/{key}").get()
    if mapped:
        return str(mapped).strip()

    schools = _raw_db_reference("Platform1/Schools").get() or {}
    for school_code, school_data in schools.items():
        school_info = (school_data or {}).get("schoolInfo") or {}
        if _normalize_short_name(school_info.get("shortName")) == key:
            return str(school_code).strip()

    return ""


def _list_school_codes():
    schools = _raw_db_reference("Platform1/Schools").get() or {}
    return [str(code).strip() for code in schools.keys()]


def _list_school_options():
    schools = _raw_db_reference("Platform1/Schools").get() or {}
    options = []

    for school_code, school_data in schools.items():
        info = (school_data or {}).get("schoolInfo") or {}
        code = str(school_code or "").strip()
        name = str(info.get("name") or code).strip()
        short_name = _normalize_short_name(info.get("shortName"))
        is_active = bool(info.get("active", True))

        options.append({
            "schoolCode": code,
            "name": name,
            "shortName": short_name,
            "active": is_active,
        })

    options.sort(key=lambda x: (not x.get("active", True), x.get("name", "")))
    return options


def _grade_sort_key(grade_label):
    text = str(grade_label or "").strip()
    if not text:
        return (9999, "")

    first = text.split(" ", 1)[0]
    if first.isdigit():
        return (int(first), text)

    return (9999, text)


def _get_grade_management_options(school_code):
    grades_raw = _raw_db_reference(f"Platform1/Schools/{school_code}/GradeManagement/grades").get() or []

    if isinstance(grades_raw, dict):
        iterable = grades_raw.values()
    elif isinstance(grades_raw, list):
        iterable = grades_raw
    else:
        iterable = []

    grades = []
    for row in iterable:
        if not isinstance(row, dict):
            continue

        grade_label = str(row.get("grade") or "").strip()
        if not grade_label:
            continue

        sections_obj = row.get("sections") or {}
        sections = []
        if isinstance(sections_obj, dict):
            sections = sorted(str(key).strip() for key in sections_obj.keys() if str(key).strip())

        grades.append({
            "grade": grade_label,
            "sections": sections,
        })

    grades.sort(key=lambda item: _grade_sort_key(item.get("grade")))
    return grades


def _resolve_school_code_for_teacher_registration():
    requested = _read_school_code_from_request()
    if requested:
        return requested

    all_codes = _list_school_codes()
    if len(all_codes) == 1:
        return all_codes[0]

    return ""


def _resolve_school_short_name(school_code):
    info = _raw_db_reference(f"Platform1/Schools/{school_code}/schoolInfo").get() or {}
    short_name = _normalize_short_name(info.get("shortName"))
    if short_name:
        return short_name

    fallback = _normalize_short_name(str(school_code or "").split("-")[-1])
    return fallback or "SCH"


def _get_default_academic_year(school_code=None):
    resolved_school = str(school_code or _read_school_code_from_request() or "").strip()
    if not resolved_school:
        return "default"

    school_info = _raw_db_reference(f"Platform1/Schools/{resolved_school}/schoolInfo").get() or {}
    current_year = str(school_info.get("currentAcademicYear") or "").strip()
    if current_year:
        return current_year

    years = _raw_db_reference(f"Platform1/Schools/{resolved_school}/AcademicYears").get() or {}
    if isinstance(years, dict):
        for year_key, year_data in years.items():
            if isinstance(year_data, dict) and year_data.get("isCurrent"):
                return str(year_key).strip()

        sorted_keys = sorted(str(key).strip() for key in years.keys() if str(key).strip())
        if sorted_keys:
            return sorted_keys[-1]

    return "default"


bucket = storage.bucket()


def _sanitize_storage_object_name(value, fallback="user"):
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "").strip()).strip("._")
    return normalized or fallback


def _upload_profile_image_to_storage(profile_file, folder, identifier):
    if not profile_file:
        return ""

    safe_identifier = _sanitize_storage_object_name(identifier, "user")
    original_name = secure_filename(profile_file.filename or "profile.jpg") or "profile.jpg"
    storage_name = f"{folder}/{safe_identifier}_{_utc_timestamp()}_{original_name}"
    blob = bucket.blob(storage_name)
    blob.upload_from_file(profile_file, content_type=profile_file.content_type)
    blob.make_public()
    return blob.public_url


def _extract_storage_object_name_from_url(public_url):
    normalized_url = str(public_url or "").strip()
    if not normalized_url:
        return ""

    parsed = urlparse(normalized_url)
    bucket_name = str(getattr(bucket, "name", "") or "").strip()
    if not bucket_name:
        return ""

    normalized_path = parsed.path.lstrip("/")
    if parsed.netloc in {"storage.googleapis.com", "storage.cloud.google.com"}:
        bucket_prefix = f"{bucket_name}/"
        if normalized_path.startswith(bucket_prefix):
            return unquote(normalized_path[len(bucket_prefix):])
        return ""

    if parsed.netloc == f"{bucket_name}.storage.googleapis.com":
        return unquote(normalized_path)

    if "firebasestorage.googleapis.com" in parsed.netloc:
        marker = f"/b/{bucket_name}/o/"
        if marker in parsed.path:
            return unquote(parsed.path.split(marker, 1)[1])

    return ""


def _delete_storage_object_by_public_url(public_url):
    object_name = _extract_storage_object_name_from_url(public_url)
    if not object_name:
        return False

    try:
        stale_blob = bucket.blob(object_name)
        if stale_blob.exists():
            stale_blob.delete()
            return True
    except Exception:
        return False

    return False


@app.route('/api/storage/delete-by-url', methods=['POST'])
def delete_storage_object_by_url():
    try:
        payload = request.get_json(silent=True) or {}
        public_url = str(payload.get('publicUrl') or payload.get('url') or '').strip()
        if not public_url:
            return jsonify({"success": False, "message": "publicUrl is required", "deleted": False}), 400

        deleted = _delete_storage_object_by_public_url(public_url)
        return jsonify({
            "success": True,
            "deleted": bool(deleted),
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e), "deleted": False}), 500


def _find_user_node(users_ref, user_identifier):
    normalized_identifier = str(user_identifier or "").strip()
    if not normalized_identifier:
        return None, None

    direct_ref = users_ref.child(normalized_identifier)
    direct_payload = direct_ref.get()
    if isinstance(direct_payload, dict):
        return normalized_identifier, direct_payload

    for child_path in ("userId", "username"):
        matched_users = (
            users_ref.order_by_child(child_path).equal_to(normalized_identifier).limit_to_first(1).get() or {}
        )
        if not isinstance(matched_users, dict):
            continue

        for node_key, payload in matched_users.items():
            if isinstance(payload, dict):
                return str(node_key or "").strip(), payload

    return None, None


# ===================== HOME PAGE =====================
@app.route('/')
def home():
    return render_template('student_register.html')


@app.route('/api/schools', methods=['GET'])
def get_schools():
    try:
        return jsonify({"success": True, "schools": _list_school_options()})
    except Exception as e:
        return jsonify({"success": False, "message": str(e), "schools": []}), 500


@app.route('/api/schools/<school_code>/grades', methods=['GET'])
def get_school_grades(school_code):
    try:
        cleaned = str(school_code or "").strip()
        if not cleaned:
            return jsonify({"success": False, "message": "schoolCode is required", "grades": []}), 400

        grades = _get_grade_management_options(cleaned)
        return jsonify({"success": True, "grades": grades})
    except Exception as e:
        return jsonify({"success": False, "message": str(e), "grades": []}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "success": True,
        "status": "ok",
        "environment": APP_ENV,
        "timestamp": _utc_now_isoformat(),
    })


@app.route('/api/users/<user_id>/profile-image', methods=['POST'])
def upload_user_profile_image(user_id):
    try:
        scope_error = _enforce_current_teacher_scope(
            user_id=user_id,
            message="Profile image updates are limited to the signed-in teacher.",
        )
        if scope_error is not None:
            return scope_error

        users_ref = school_reference('Users')
        user_node_key, user_payload = _find_user_node(users_ref, user_id)
        if not user_node_key or not isinstance(user_payload, dict):
            return jsonify({"success": False, "message": "User not found"}), 404

        profile_file = request.files.get('profile')
        if not profile_file:
            return jsonify({"success": False, "message": "Profile image file is required"}), 400

        role = str(user_payload.get('role') or 'teacher').strip().lower()
        if role == 'school_admins':
            role = 'school_admin'
        folder = {
            'teacher': 'teachers',
            'school_admin': 'school_admins',
            'management': 'school_admins',
            'hr': 'hr',
            'finance': 'finance',
            'parent': 'parents',
            'student': 'students',
        }.get(role, 'users')

        identifier = (
            user_payload.get('teacherId')
            or user_payload.get('schoolAdminId')
            or user_payload.get('managementId')
            or user_payload.get('hrId')
            or user_payload.get('financeId')
            or user_payload.get('studentId')
            or user_payload.get('username')
            or user_payload.get('userId')
            or user_node_key
        )
        previous_profile_url = str(user_payload.get('profileImage') or '').strip()
        profile_url = _upload_profile_image_to_storage(profile_file, folder, identifier)

        users_ref.child(user_node_key).update({
            'profileImage': profile_url,
        })

        teacher_user_id = str(user_payload.get('userId') or user_node_key).strip()
        teacher_matches = (
            school_reference('Teachers').order_by_child('userId').equal_to(teacher_user_id).limit_to_first(1).get() or {}
        )
        if isinstance(teacher_matches, dict):
            for teacher_key in teacher_matches.keys():
                school_reference('Teachers').child(teacher_key).update({'profileImage': profile_url})

        if previous_profile_url and previous_profile_url != profile_url:
            _delete_storage_object_by_public_url(previous_profile_url)

        return jsonify({
            'success': True,
            'profileImage': profile_url,
            'userId': user_node_key,
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# New endpoint: reserve & return the next studentId
@app.route("/generate/student_id", methods=["GET"])
def generate_student_id():
    """
    Atomically increment the students counter and return a studentId in format:
      GES_<zero-padded-4+>_<YY>  e.g. GES_0001_26
    This reserves that sequence number.
    """
    try:
        counters_ref = school_reference("Users_counters/students")
        students_ref = school_reference("Students")

        # Defensive: bring counter up to existing max (one-time migration)
        existing_students = students_ref.get() or {}
        max_found = 0
        for s in existing_students.values():
            sid = (s.get("studentId") or "")
            if sid and sid.startswith("GES_"):
                parts = sid.split("_")
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip("0") or "0")
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue

        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        def tx_inc(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = _utc_now().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        student_id = f"GES_{seq_padded}_{year_suffix}"

        # Extremely unlikely collision check (increment until unique)
        attempts = 0
        while students_ref.child(student_id).get():
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            student_id = f"GES_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                # fallback to timestamp-based id
                student_id = f"GES_{str(_utc_timestamp())[-6:]}_{year_suffix}"
                break

        return jsonify({"success": True, "studentId": student_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Updated register_student: use provided studentId when present
@app.route('/register/student', methods=['POST'])
def register_student():
    """
    Register a student. If the frontend does not provide a username,
    the server generates a unique studentId and uses it as the username.
    studentId format: GES_<zero-padded-4+>_<YY>, e.g. GES_0001_26
    Students record is written under Students/<studentId>.
    """
    from datetime import datetime

    data = request.form
    profile_file = request.files.get('profile')

    # Frontend no longer submits username; server will set username = studentId
    provided_username = (data.get('username') or "").strip()  # if frontend ever sends it
    name = (data.get('name') or "").strip()
    password = data.get('password') or ""
    grade = data.get('grade') or ""
    section = data.get('section') or ""

    # Optional fields
    email = (data.get('email') or "").strip()
    phone = (data.get('phone') or "").strip()
    dob = data.get('dob') or ""
    gender = data.get('gender') or ""

    if not all([name, password, grade, section]):
        return jsonify({'success': False, 'message': 'Name, password, grade and section are required.'}), 400

    users_ref = school_reference('Users')
    students_ref = school_reference('Students')
    counters_ref = school_reference('counters/students')

    # ---------- upload profile image (optional) ----------
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"students/{(provided_username or 'student')}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # ========== Generate studentId atomically ==========
    try:
        # Defensive: compute numeric max already present (if any)
        existing_students = students_ref.get() or {}
        max_found = 0
        for s in existing_students.values():
            sid = (s.get('studentId') or "")
            if sid and sid.startswith("GES_"):
                parts = sid.split('_')
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip('0') or '0')
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue

        # ensure counter isn't behind
        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        # transaction to allocate next sequence number
        def tx_increment(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_increment)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = _utc_now().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        student_id = f"GES_{seq_padded}_{year_suffix}"

        # ensure student_id and username will be unique; if conflict, bump counter
        attempts = 0
        while True:
            # check student key existence and username collision
            student_exists = bool(students_ref.child(student_id).get())
            # check username collision (if provided_username present we handle below; here we plan to use student_id as username)
            user_collision = False
            all_users = users_ref.get() or {}
            for u in all_users.values():
                if u.get('username') == student_id:
                    user_collision = True
                    break

            if not student_exists and not user_collision:
                break

            # collision -> increment counter and try next
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            student_id = f"GES_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                # fallback
                student_id = f"GES_{str(_utc_timestamp())[-6:]}_{year_suffix}"
                break
    except Exception as e:
        # fallback if transaction fails
        year = _utc_now().year
        year_suffix = str(year)[-2:]
        student_id = f"GES_{str(_utc_timestamp())[-6:]}_{year_suffix}"

    # If frontend supplied an explicit username, use it (but check uniqueness). Otherwise set username = student_id
    username = provided_username or student_id

    # Check username uniqueness (if frontend provided, reject; if we assigned, collision already checked above)
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == username:
            # If username equals provided_username (user attempted to set), reject with error
            if provided_username:
                return jsonify({'success': False, 'message': 'Username already exists!'}), 400
            else:
                # If collision occurred when username=student_id (very unlikely), increment counter and regenerate student_id & username
                # Simple fallback: append random suffix (to guarantee uniqueness)
                import random, string
                suffix = ''.join(random.choices(string.digits, k=3))
                username = f"{student_id}_{suffix}"
                break

    academic_year = f"{year-1}_{year}"

    # ========== Create Users entry (push key) ==========
    new_user_ref = users_ref.push()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,     # TODO: hash in production
        'profileImage': profile_url,
        'role': 'student',
        'isActive': True,
        'email': email,
        'phone': phone,
        'dob': dob,
        'gender': gender,
        'studentId': student_id
    }
    new_user_ref.set(user_data)

    # ========== Create Students entry keyed by studentId ==========
    student_data = {
        'userId': new_user_ref.key,
        'studentId': student_id,
        'academicYear': academic_year,
        'dob': dob,
        'grade': grade,
        'section': section,
        'status': 'active',
    }
    students_ref.child(student_id).set(student_data)
    _clear_student_roster_cache(_resolve_requested_school_code())

    return jsonify({
        'success': True,
        'message': 'Student registered successfully!',
        'studentId': student_id,
        'username': username,
        'profileImage': profile_url
    })
# ===================== TEACHER REGISTRATION =====================
@app.route('/register/teacher', methods=['POST'])
def register_teacher():
    """
    Register a teacher. If frontend does not provide username, server will generate
    a teacherId in format GET_<zero-padded-4+>_<YY> (e.g. GET_0001_26) and use it
    as the username. Teacher record is written under Teachers/<teacherId>.
    Response includes teacherKey (teacherId) so frontend can display it.
    """
    from datetime import datetime
    import json

    school_code = _resolve_school_code_for_teacher_registration()
    if not school_code:
        return jsonify({'success': False, 'message': 'Unable to resolve school for registration.'}), 400

    school_short_name = _resolve_school_short_name(school_code)

    name = request.form.get('name')
    provided_username = (request.form.get('username') or "").strip()
    password = request.form.get('password')
    email = request.form.get('email')
    phone = request.form.get('phone')
    gender = request.form.get('gender')
    courses = json.loads(request.form.get('courses', '[]'))
    profile_file = request.files.get('profile')

    if not all([name, password]):
        return jsonify({'success': False, 'message': 'Name and password are required.'}), 400

    if not _password_meets_teacher_requirements(password):
        return jsonify({
            'success': False,
            'message': 'Password must be at least 8 characters and include both letters and numbers.',
        }), 400

    users_ref = school_reference('Users', school_code)
    teachers_ref = school_reference('Teachers', school_code)
    courses_ref = school_reference('Courses', school_code)
    assignments_ref = school_reference('TeacherAssignments', school_code)
    counters_ref = school_reference('counters/teachers', school_code)

    # check username uniqueness if provided (we won't rely on frontend providing it)
    all_users = users_ref.get() or {}
    if provided_username:
        for u in all_users.values():
            if u.get('username') == provided_username:
                return jsonify({'success': False, 'message': 'Username already exists!'}), 400

    # subject conflict check (existing assignments)
    existing_assignments = assignments_ref.get() or {}
    for course in courses:
        grade = course.get('grade')
        section = course.get('section')
        subject = course.get('subject')
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"
        for a in existing_assignments.values():
            if a.get('courseId') == course_id:
                return jsonify({'success': False, 'message': f'{subject} already assigned in Grade {grade}{section}'}), 400

    # profile upload
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"teachers/{(provided_username or name).replace(' ','_')}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # generate teacherId if no username provided
    try:
        # compute max existing seq (defensive)
        existing_teachers = teachers_ref.get() or {}
        max_found = 0
        id_prefix = f"{school_short_name}T_"
        for t in existing_teachers.values():
            tid = (t.get('teacherId') or "")
            if tid and tid.startswith(id_prefix):
                parts = tid.split('_')
                if len(parts) >= 3:
                    try:
                        num = int(parts[1].lstrip('0') or '0')
                        if num > max_found:
                            max_found = num
                    except Exception:
                        continue
        try:
            current_counter = counters_ref.get() or 0
            if current_counter < max_found:
                counters_ref.set(max_found)
        except Exception:
            pass

        def tx_inc(curr):
            return (curr or 0) + 1

        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int):
            new_seq = int(new_seq)

        year = _utc_now().year
        year_suffix = str(year)[-2:]
        seq_padded = str(new_seq).zfill(4)
        teacher_id = f"{school_short_name}T_{seq_padded}_{year_suffix}"

        # ensure uniqueness for teacherId and username
        attempts = 0
        while teachers_ref.child(teacher_id).get() or any(u.get('username') == teacher_id for u in (users_ref.get() or {}).values()):
            new_seq += 1
            seq_padded = str(new_seq).zfill(4)
            teacher_id = f"{school_short_name}T_{seq_padded}_{year_suffix}"
            attempts += 1
            if attempts > 1000:
                teacher_id = f"{school_short_name}T_{str(_utc_timestamp())[-6:]}_{year_suffix}"
                break
    except Exception:
        year = _utc_now().year
        year_suffix = str(year)[-2:]
        teacher_id = f"{school_short_name}T_{str(_utc_timestamp())[-6:]}_{year_suffix}"

    # final username: either provided_username or teacher_id
    username = provided_username or teacher_id

    # create Users entry (push key)
    new_user_ref = users_ref.push()
    password_updated_at = _utc_now_isoformat()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'passwordHash': _build_password_hash(password),
        'passwordUpdatedAt': password_updated_at,
        'role': 'teacher',
        'isActive': True,
        'profileImage': profile_url,
        'email': email,
        'phone': phone,
        'gender': gender,
        'schoolCode': school_code,
        'teacherId': teacher_id
    }
    new_user_ref.set(user_data)

    # create Teachers entry keyed by teacherId
    teacher_data = {
        'userId': new_user_ref.key,
        'teacherId': teacher_id,
        'schoolCode': school_code,
        'status': 'active',
       
    }
    teachers_ref.child(teacher_id).set(teacher_data)

    # assign courses (use teacher_id as identifier)
    for course in courses:
        grade = course.get('grade')
        section = course.get('section')
        subject = course.get('subject')
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"
        if not courses_ref.child(course_id).get():
            courses_ref.child(course_id).set({
                'name': subject,
                'subject': subject,
                'grade': grade,
                'section': section
            })
        assignments_ref.push().set({
            'teacherId': teacher_id,
            'courseId': course_id
        })

    return jsonify({
        'success': True,
        'message': 'Teacher registered successfully!',
        'teacherKey': teacher_id,
        'schoolCode': school_code,
        'profileImage': profile_url
    })

# ===================== TEACHER LOGIN =====================
@app.route("/api/teacher_login", methods=["POST"])
def teacher_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    inferred_short_name = _extract_short_name_from_teacher_id(username.upper())
    if not inferred_short_name:
        return jsonify({
            "success": False,
            "message": "Invalid username format. Username must begin with a 3-letter school prefix."
        }), 400

    inferred_school_code = _resolve_school_code_by_short_name(inferred_short_name)
    if not inferred_school_code:
        return jsonify({
            "success": False,
            "message": f"School code '{inferred_short_name}' was not found."
        }), 404

    # Login is strictly scoped by the username prefix -> schoolCodeIndex mapping.
    search_codes = [inferred_school_code]

    teacher_user = None
    teacher_key = None
    teacher_user_id = ""
    school_code = ""
    all_teachers = {}

    for candidate_school_code in search_codes:
        users_ref = school_reference("Users", candidate_school_code)
        teachers_ref = school_reference("Teachers", candidate_school_code)

        normalized_username = username.upper()
        candidate_teachers = {}

        # Fast path: teacher username is commonly the teacherId, which is also the Teachers key.
        for direct_teacher_key in {username, normalized_username}:
            direct_teacher = teachers_ref.child(direct_teacher_key).get()
            if not isinstance(direct_teacher, dict):
                continue

            direct_user_id = str(direct_teacher.get("userId") or "").strip()
            if not direct_user_id:
                continue

            direct_user = users_ref.child(direct_user_id).get() or {}
            direct_role = str(direct_user.get("role") or "").strip().lower()
            direct_username = str(direct_user.get("username") or "").strip().upper()

            is_teacher_user = direct_role in ("", "teacher")
            matches_username = direct_username == normalized_username

            if is_teacher_user and matches_username:
                teacher_user = direct_user
                teacher_key = direct_teacher_key
                teacher_user_id = direct_user_id
                school_code = candidate_school_code
                all_teachers = {direct_teacher_key: direct_teacher}
                break

        if teacher_key and teacher_user:
            break

        # Medium path: walk Teachers first, then fetch linked user directly by userId.
        candidate_teachers = teachers_ref.get() or {}
        for tkey, tdata in candidate_teachers.items():
            if not isinstance(tdata, dict):
                continue

            possible_teacher_ids = {
                str(tkey or "").strip().upper(),
                str(tdata.get("teacherId") or "").strip().upper(),
                str(tdata.get("userId") or "").strip().upper(),
            }
            if normalized_username not in possible_teacher_ids:
                continue

            linked_user_id = str(tdata.get("userId") or "").strip()
            if not linked_user_id:
                continue

            linked_user = users_ref.child(linked_user_id).get() or {}
            linked_role = str(linked_user.get("role") or "").strip().lower()
            linked_username = str(linked_user.get("username") or "").strip().upper()

            if linked_role not in ("", "teacher"):
                continue
            if linked_username and linked_username != normalized_username and normalized_username != str(tkey).strip().upper():
                continue

            teacher_user = linked_user
            teacher_key = tkey
            teacher_user_id = linked_user_id
            school_code = candidate_school_code
            all_teachers = candidate_teachers
            break

        if teacher_key and teacher_user:
            break

        # Slow fallback: support custom usernames by scanning Users only when needed.
        all_users = users_ref.get() or {}
        found_user_key = None
        for user_key, user in all_users.items():
            user_username = str(user.get("username") or "").strip().upper()
            user_role = str(user.get("role") or "").strip().lower()
            if user_username == normalized_username and user_role in ("", "teacher"):
                teacher_user = user
                found_user_key = user_key
                break

        if not teacher_user:
            continue

        if not candidate_teachers:
            candidate_teachers = teachers_ref.get() or {}

        for tkey, tdata in candidate_teachers.items():
            if str(tdata.get("userId") or "").strip() == str(found_user_key).strip():
                teacher_key = tkey
                break

        if teacher_key:
            school_code = candidate_school_code
            all_teachers = candidate_teachers
            teacher_user_id = str(teacher_user.get("userId") or found_user_key or "").strip()
            break

        teacher_user = None

    if not teacher_user or not teacher_key:
        return jsonify({"success": False, "message": "Teacher not found for the detected school"}), 404

    users_ref = school_reference("Users", school_code)
    credentials_valid, verified_teacher_user, auth_error = _verify_teacher_user_credentials(
        users_ref,
        teacher_user_id,
        password,
        expected_username=username,
    )
    if not credentials_valid:
        return jsonify({"success": False, "message": auth_error or "Invalid password"}), 401

    teacher_user = verified_teacher_user or teacher_user

    teacher_record = all_teachers.get(teacher_key, {}) or {}
    profile_image = (
        teacher_user.get("profileImage")
        or teacher_user.get("profile")
        or teacher_record.get("profileImage")
        or teacher_record.get("profile")
        or "/default-profile.png"
    )

    teacher_payload = {
        "teacherKey": teacher_key,
        "userId": teacher_user_id,
        "name": teacher_user.get("name"),
        "username": teacher_user.get("username"),
        "profileImage": profile_image,
        "schoolCode": school_code,
        "teacherId": teacher_key,
        "hasPasswordSet": bool(teacher_user.get("passwordHash") or teacher_user.get("password")),
        "passwordUpdatedAt": teacher_user.get("passwordUpdatedAt") or None,
    }

    _write_teacher_session(teacher_payload)

    return jsonify({
        "success": True,
        "teacher": teacher_payload
    })


@app.route("/api/teacher/logout", methods=["POST"])
def teacher_logout():
    _clear_teacher_session()
    return jsonify({"success": True})


@app.route("/api/teacher/verify-password", methods=["POST"])
def verify_teacher_password():
    data = request.get_json(silent=True) or {}
    school_code = _resolve_requested_school_code(data.get("schoolCode"))
    user_id = str(data.get("userId") or "").strip()
    username = str(data.get("username") or "").strip()
    password = data.get("password")

    if not school_code or not user_id or not username or not _normalize_password_value(password):
        return jsonify({
            "success": False,
            "message": "schoolCode, userId, username and password are required",
        }), 400

    teacher_session = _get_teacher_session()
    if not _teacher_session_matches(teacher_session, school_code=school_code, user_id=user_id, username=username):
        return jsonify({
            "success": False,
            "message": "You can only verify the current teacher session credentials.",
        }), 403

    users_ref = school_reference("Users", school_code)
    credentials_valid, _, auth_error = _verify_teacher_user_credentials(
        users_ref,
        user_id,
        password,
        expected_username=username,
    )
    if not credentials_valid:
        return jsonify({"success": False, "message": auth_error or "Invalid password"}), 401

    return jsonify({"success": True})


@app.route("/api/teacher/change-password", methods=["POST"])
def change_teacher_password():
    data = request.get_json(silent=True) or {}
    school_code = _resolve_requested_school_code(data.get("schoolCode"))
    user_id = str(data.get("userId") or "").strip()
    username = str(data.get("username") or "").strip()
    old_password = data.get("oldPassword")
    new_password = data.get("newPassword")

    if not school_code or not user_id or not username or not _normalize_password_value(old_password) or not _normalize_password_value(new_password):
        return jsonify({
            "success": False,
            "message": "schoolCode, userId, username, oldPassword and newPassword are required",
        }), 400

    if _normalize_password_value(old_password) == _normalize_password_value(new_password):
        return jsonify({
            "success": False,
            "message": "New password must be different from the old password",
        }), 400

    if not _password_meets_teacher_requirements(new_password):
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters and include both letters and numbers.",
        }), 400

    teacher_session = _get_teacher_session()
    if not _teacher_session_matches(teacher_session, school_code=school_code, user_id=user_id, username=username):
        return jsonify({
            "success": False,
            "message": "You can only update the current teacher session password.",
        }), 403

    users_ref = school_reference("Users", school_code)
    credentials_valid, _, auth_error = _verify_teacher_user_credentials(
        users_ref,
        user_id,
        old_password,
        expected_username=username,
    )
    if not credentials_valid:
        return jsonify({"success": False, "message": auth_error or "Invalid password"}), 401

    password_updated_at = _write_user_password_hash(users_ref, user_id, new_password)
    return jsonify({
        "success": True,
        "hasPasswordSet": True,
        "passwordUpdatedAt": password_updated_at,
    })


@app.route("/api/teacher_context", methods=["GET"])
def teacher_context():
    teacher_id = str(request.args.get("teacherId") or "").strip()
    user_id = str(request.args.get("userId") or "").strip()

    teacher_session = _get_teacher_session()
    if not teacher_id and not user_id:
        teacher_id = teacher_session.get("teacherKey") or teacher_session.get("teacherId")
        user_id = teacher_session.get("userId")

    if teacher_id and not _teacher_session_matches(teacher_session, teacher_key=teacher_id):
        return jsonify({"success": False, "message": "Teacher context is limited to the signed-in teacher."}), 403

    if user_id and not _teacher_session_matches(teacher_session, user_id=user_id):
        return jsonify({"success": False, "message": "Teacher context is limited to the signed-in teacher."}), 403

    search_codes = [_resolve_requested_school_code(teacher_session.get("schoolCode"))]

    for school_code in search_codes:
        teachers = school_reference("Teachers", school_code).get() or {}
        users = school_reference("Users", school_code).get() or {}

        for teacher_key, teacher_data in teachers.items():
            teacher_user_id = str(teacher_data.get("userId") or "").strip()
            teacher_teacher_id = str(teacher_data.get("teacherId") or teacher_key or "").strip()

            if teacher_id and teacher_teacher_id != teacher_id:
                continue
            if user_id and teacher_user_id != user_id:
                continue

            teacher_user = users.get(teacher_user_id) or next(
                (user for user in users.values() if str(user.get("userId") or "").strip() == teacher_user_id),
                {},
            )

            return jsonify({
                "success": True,
                "teacher": {
                    "teacherId": teacher_teacher_id,
                    "teacherKey": teacher_key,
                    "userId": teacher_user_id,
                    "name": teacher_user.get("name") or teacher_data.get("name"),
                    "username": teacher_user.get("username") or teacher_teacher_id,
                    "profileImage": teacher_user.get("profileImage") or teacher_data.get("profileImage") or "/default-profile.png",
                    "schoolCode": school_code,
                }
            })

    return jsonify({"success": False, "message": "Teacher context not found"}), 404


# ===================== GET TEACHER COURSES =====================
@app.route('/api/teacher/<teacher_key>/courses', methods=['GET'])
def get_teacher_courses(teacher_key):
    if not _teacher_session_matches(_get_teacher_session(), teacher_key=teacher_key):
        return jsonify({"success": False, "message": "Course access is limited to the signed-in teacher."}), 403

    courses_ref = school_reference('Courses')
    teacher_identifiers = {teacher_key}
    teachers_ref = school_reference('Teachers')
    teacher_record = teachers_ref.child(teacher_key).get() or {}
    if teacher_record:
        teacher_identifiers.add(teacher_record.get('teacherId'))
        teacher_identifiers.add(teacher_record.get('userId'))

    course_entries = _resolve_teacher_course_entries(_read_school_code_from_request(), teacher_identifiers, teacher_key)
    courses_list = []

    for course_entry in course_entries:
        course_id = course_entry.get('courseId')
        course_data = courses_ref.child(course_id).get() or {}
        courses_list.append({
            'courseId': course_id,
            'subject': course_data.get('subject') or course_entry.get('subject'),
            'grade': course_data.get('grade') or course_entry.get('grade'),
            'section': course_data.get('section') or course_data.get('secation') or course_entry.get('section'),
            'virtual': course_entry.get('virtual', False),
        })

    return jsonify({'courses': courses_list})


# ===================== GET TEACHER STUDENTS =====================
@app.route("/api/teacher/<user_id>/students", methods=["GET"])
def get_teacher_students(user_id):
    if not _teacher_session_matches(_get_teacher_session(), user_id=user_id):
        return jsonify({"success": False, "message": "Student access is limited to the signed-in teacher."}), 403

    teachers_ref = school_reference("Teachers")
    courses_ref = school_reference("Courses")
    students_ref = school_reference("Students")
    users_ref = school_reference("Users")
    marks_ref = school_reference("ClassMarks")

    # 1️⃣ Get the teacher key from Teachers node using user_id
    teacher_key = None
    all_teachers = teachers_ref.get() or {}
    for key, teacher in all_teachers.items():
        if teacher.get("userId") == user_id:
            teacher_key = key
            break

    if not teacher_key:
        return jsonify({"courses": [], "message": "Teacher not found"})

    teacher_identifiers = {teacher_key, user_id}
    teacher_record = all_teachers.get(teacher_key) or {}
    teacher_identifiers.add(teacher_record.get("teacherId"))
    course_entries = _resolve_teacher_course_entries(_read_school_code_from_request(), teacher_identifiers, teacher_key)
    course_students = []

    for course_entry in course_entries:
        course_id = course_entry.get("courseId")
        course_data = courses_ref.child(course_id).get() or {}

        grade = course_data.get("grade") or course_entry.get("grade")
        section = course_data.get("section") or course_data.get("secation") or course_entry.get("section")
        subject = course_data.get("subject") or course_entry.get("subject")
        if not grade or not section:
            continue

        # 3️⃣ Fetch students in this grade + section
        students_list = []
        all_students = students_ref.get() or {}
        for student_id, student in all_students.items():
            if student.get("grade") == grade and student.get("section") == section:
                user_data = users_ref.child(student.get("userId")).get()
                if not user_data:
                    continue

                # Get marks for this course
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}

                students_list.append({
                    "studentId": student_id,
                    "name": user_data.get("name"),
                    "username": user_data.get("username"),
                    "marks": {
                        "mark20": student_marks.get("mark20", 0),
                        "mark30": student_marks.get("mark30", 0),
                        "mark50": student_marks.get("mark50", 0)
                    }
                })

        course_students.append({
            "subject": subject,
            "grade": grade,
            "section": section,
            "students": students_list
        })

    return jsonify({"courses": course_students})


@app.route('/api/students/by-grade-sections', methods=['GET'])
def get_students_by_grade_sections():
    resolved_school_code = _resolve_requested_school_code()
    allowed_grade_sections = {
        str(value or '').strip()
        for value in request.args.getlist('gradeSection')
        if str(value or '').strip()
    }
    include_inactive = str(request.args.get('includeInactive') or '').strip().lower() in {'1', 'true', 'yes'}

    if not resolved_school_code or not allowed_grade_sections:
        return jsonify([])

    return jsonify(_load_students_for_grade_sections(
        resolved_school_code,
        allowed_grade_sections,
        include_inactive=include_inactive,
    ))


@app.route('/api/parents/by-ids', methods=['GET'])
def get_parents_by_ids():
    resolved_school_code = _resolve_requested_school_code()
    parent_identifiers = []
    seen_identifiers = set()

    for raw_identifier in request.args.getlist('parentId'):
        normalized_identifier = str(raw_identifier or '').strip()
        if not normalized_identifier or normalized_identifier in seen_identifiers:
            continue
        seen_identifiers.add(normalized_identifier)
        parent_identifiers.append(normalized_identifier)

    if not resolved_school_code or not parent_identifiers:
        return jsonify({})

    records_by_identifier = {}
    for parent_identifier in parent_identifiers:
        _, parent_record = _load_parent_record_by_identifier(resolved_school_code, parent_identifier)
        if isinstance(parent_record, dict) and parent_record:
            records_by_identifier[parent_identifier] = parent_record

    return jsonify(records_by_identifier)


# ===================== GET STUDENTS OF A COURSE =====================
@app.route('/api/course/<course_id>/students', methods=['GET'])
def get_course_students(course_id):
    resolved_school_code = _resolve_requested_school_code()
    courses_ref = school_reference('Courses', school_code=resolved_school_code)
    include_marks = str(request.args.get('includeMarks') or '').strip().lower() in {'1', 'true', 'yes'}

    course = courses_ref.child(course_id).get()
    if not course:
        return jsonify({'students': [], 'course': None})

    grade = str(course.get('grade') or '').strip()
    section = str(course.get('section') or course.get('secation') or '').strip().upper()

    grade_section_key = f'{grade}|{section}'
    course_students = []

    for row in _load_students_for_grade_sections(
        resolved_school_code,
        {grade_section_key},
        include_inactive=True,
    ):
        student_id = str(row.get('studentId') or '').strip()
        student = row.get('raw') or {}
        user_data = row.get('user') or {}

        student_name = str(
            user_data.get('name')
            or student.get('name')
            or (student.get('basicStudentInformation') or {}).get('name')
            or 'Student'
        ).strip() or 'Student'

        course_student = {
            'studentId': student_id,
            'userId': str(row.get('userId') or '').strip(),
            'name': student_name,
            'username': user_data.get('username') or '',
            'profileImage': (
                user_data.get('profileImage')
                or student.get('profileImage')
                or (student.get('basicStudentInformation') or {}).get('studentPhoto')
                or student.get('studentPhoto')
                or ''
            ),
        }

        if include_marks:
            student_marks = school_reference(f'ClassMarks/{course_id}/{student_id}', school_code=resolved_school_code).get() or {}
            course_student['marks'] = {
                'mark20': student_marks.get('mark20', 0),
                'mark30': student_marks.get('mark30', 0),
                'mark50': student_marks.get('mark50', 0),
                'mark100': student_marks.get('mark100', 0)
            }

        course_students.append(course_student)

    course_students.sort(key=lambda item: str(item.get('name') or '').lower())

    return jsonify({
        'students': course_students,
        'course': {
            'subject': course.get('subject'),
            'grade': grade,
            'section': section
        }
    })


# ===================== UPDATE STUDENT MARKS =====================
@app.route('/api/course/<course_id>/update-marks', methods=['POST'])
def update_course_marks(course_id):
    data = request.json
    updates = data.get('updates', [])
    marks_ref = school_reference('ClassMarks')

    for update in updates:
        student_id = update.get('studentId')
        marks = update.get('marks', {})
        marks_ref.child(course_id).child(student_id).set({
            'mark20': marks.get('mark20', 0),
            'mark30': marks.get('mark30', 0),
            'mark50': marks.get('mark50', 0)
        })

    return jsonify({'success': True, 'message': 'Marks updated successfully!'})


# ===================== GET POSTS =====================
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    viewer_role = str(request.args.get("viewerRole") or "").strip().lower()
    try:
        requested_limit = int(request.args.get("limit") or 25)
    except (TypeError, ValueError):
        requested_limit = 25
    posts_limit = max(1, min(requested_limit, 100))

    def _normalize_target_role(post_value):
        if not isinstance(post_value, dict):
            return ""

        direct_target = (
            post_value.get("targetRole")
            or post_value.get("TargetRole")
            or post_value.get("targetrole")
            or post_value.get("target")
            or post_value.get("targetUserType")
            or post_value.get("targetAudience")
            or ""
        )

        if isinstance(direct_target, list):
            return ",".join(
                str(item or "").strip().lower()
                for item in direct_target
                if str(item or "").strip()
            )

        return str(direct_target or "").strip().lower()

    def _is_visible_to_viewer(post_value):
        if viewer_role != "teacher":
            return True

        normalized_target = _normalize_target_role(post_value)
        target_parts = [
            part.strip()
            for part in re.split(r"[\s,|]+", normalized_target)
            if part.strip()
        ]

        if not target_parts:
            return True

        return "all" in target_parts or "teacher" in target_parts or "teachers" in target_parts

    def _limited_posts_snapshot(posts_reference):
        try:
            posts_snapshot = posts_reference.order_by_child("time").limit_to_last(posts_limit).get() or {}
        except Exception:
            try:
                posts_snapshot = posts_reference.order_by_key().limit_to_last(posts_limit).get() or {}
            except Exception:
                posts_snapshot = posts_reference.get() or {}

        if not isinstance(posts_snapshot, dict):
            return {}
        return posts_snapshot

    def _first_query_result(snapshot):
        if isinstance(snapshot, dict):
            for item_key, item_value in snapshot.items():
                if isinstance(item_value, dict):
                    return item_key, item_value
        return None, None

    def _load_actor_record(raw_actor_id):
        normalized_actor_id = str(raw_actor_id or "").strip()
        if not normalized_actor_id:
            return None, {}, {}

        school_admin_key = None
        school_admin_record = school_admin_cache.get(normalized_actor_id)
        if school_admin_record is None:
            school_admin_record = school_admins_ref.child(normalized_actor_id).get() or {}
            if isinstance(school_admin_record, dict) and school_admin_record:
                school_admin_cache[normalized_actor_id] = school_admin_record
            else:
                school_admin_cache[normalized_actor_id] = {}

        if isinstance(school_admin_record, dict) and school_admin_record:
            school_admin_key = normalized_actor_id

        user = users_cache.get(normalized_actor_id)
        if user is None:
            user = users_ref.child(normalized_actor_id).get() or {}
            users_cache[normalized_actor_id] = user if isinstance(user, dict) else {}

        if (not isinstance(user, dict) or not user) and isinstance(school_admin_record, dict):
            admin_user_id = str(school_admin_record.get("userId") or "").strip()
            if admin_user_id:
                user = users_cache.get(admin_user_id)
                if user is None:
                    user = users_ref.child(admin_user_id).get() or {}
                    users_cache[admin_user_id] = user if isinstance(user, dict) else {}

        if not isinstance(user, dict) or not user:
            user_query_key = f"userId:{normalized_actor_id}"
            user = users_cache.get(user_query_key)
            if user is None:
                try:
                    _, user = _first_query_result(
                        users_ref.order_by_child("userId").equal_to(normalized_actor_id).limit_to_first(1).get()
                    )
                except Exception:
                    user = {}
                users_cache[user_query_key] = user if isinstance(user, dict) else {}

        if not isinstance(school_admin_record, dict) or not school_admin_record:
            admin_query_key = f"userId:{normalized_actor_id}"
            cached_admin_query = school_admin_cache.get(admin_query_key)
            if cached_admin_query is None:
                try:
                    school_admin_key, school_admin_record = _first_query_result(
                        school_admins_ref.order_by_child("userId").equal_to(normalized_actor_id).limit_to_first(1).get()
                    )
                except Exception:
                    school_admin_key, school_admin_record = None, {}
                school_admin_cache[admin_query_key] = {
                    "key": school_admin_key,
                    "record": school_admin_record if isinstance(school_admin_record, dict) else {},
                }
            else:
                school_admin_key = cached_admin_query.get("key")
                school_admin_record = cached_admin_query.get("record") or {}

        return school_admin_key, user if isinstance(user, dict) else {}, school_admin_record if isinstance(school_admin_record, dict) else {}

    posts_ref = school_reference("Posts")
    users_ref = school_reference("Users")
    school_admins_ref = school_reference("School_Admins")

    all_posts = _limited_posts_snapshot(posts_ref)
    users_cache = {}
    school_admin_cache = {}

    result = []

    for post_id, post in all_posts.items():
        if not isinstance(post, dict):
            continue
        if not _is_visible_to_viewer(post):
            continue

        raw_admin_id = post.get("adminId")
        school_admin_key, user, school_admin_record = _load_actor_record(raw_admin_id)

        admin_user_id = str(user.get("userId") or (school_admin_record or {}).get("userId") or raw_admin_id or "").strip()

        result.append({
            "postId": post_id,
            "adminId": school_admin_key or raw_admin_id,
            "adminUserId": admin_user_id,
            "adminName": user.get("name") or (school_admin_record or {}).get("name") or "Admin",
            "adminProfile": user.get("profileImage") or (school_admin_record or {}).get("profileImage") or "/default-profile.png",
            "message": post.get("message", ""),
            "postUrl": post.get("postUrl"),
            "timestamp": post.get("time", ""),
            "time": post.get("time", ""),
            "createdAt": post.get("createdAt", ""),
            "targetRole": _normalize_target_role(post),
            "likeCount": post.get("likeCount", 0),
            "likes": post.get("likes", {})
        })

    result.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify(result)


@app.route("/api/mark_teacher_post_seen", methods=["POST"])
def mark_teacher_post_seen():
    try:
        data = request.get_json()
        post_id = data.get("postId")
        teacher_id = data.get("teacherId")
        posts_ref = school_reference("TeacherPosts")

        if not post_id or not teacher_id:
            return jsonify({"success": False, "message": "Missing postId or teacherId"}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message="Teacher post updates are limited to the signed-in teacher.",
        )
        if scope_error is not None:
            return scope_error

        post_ref = posts_ref.child(post_id)
        post = post_ref.get()

        if not post:
            return jsonify({"success": False, "message": "Post not found"}), 404

        seen_by = post.get("seenBy", {})
        seen_by[teacher_id] = True
        post_ref.update({"seenBy": seen_by})

        return jsonify({"success": True}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# ===================== PARENT REGISTRATION =====================
@app.route('/register/parent', methods=['POST'])
def register_parent():
    name = request.form.get('name')
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    profile_file = request.files.get('profile')

    # Multiple children
    student_ids = request.form.getlist('studentId')
    relationships = request.form.getlist('relationship')

    # Validation
    if not all([name, username, phone, password]) or not student_ids or not relationships:
        return jsonify({
            "success": False,
            "message": "All fields except profile photo are required"
        }), 400

    if len(student_ids) != len(relationships):
        return jsonify({
            "success": False,
            "message": "Each student must have a relationship"
        }), 400

    users_ref = school_reference('Users')
    parents_ref = school_reference('Parents')
    students_ref = school_reference('Students')

    # Check username uniqueness
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get("username") == username:
            return jsonify({
                "success": False,
                "message": "Username already exists"
            }), 409

    # Upload profile image (optional)
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"parents/{username}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # 1️⃣ Create parent USER
    new_user_ref = users_ref.push()
    parent_user_id = new_user_ref.key

    new_user_ref.set({
        "userId": parent_user_id,
        "username": username,
        "phone": phone,
        "name": name,
        "password": password,  # ⚠ hash later
        "role": "parent",
        "profileImage": profile_url,
        "isActive": True
    })

    # 2️⃣ Create PARENT node (new parentId)
    parent_ref = parents_ref.push()
    parent_id = parent_ref.key

    parent_ref.set({
        "userId": parent_user_id,
        "status": "active",
        "createdAt": _utc_now_isoformat(),
        "children": {}
    })

    # 3️⃣ Link children BOTH ways
    for student_id, relationship in zip(student_ids, relationships):
        student_data = students_ref.child(student_id).get()
        if not student_data:
            continue  # skip invalid student

        # Add child under Parents
        parent_ref.child("children").push({
            "studentId": student_id,
            "relationship": relationship
        })

        # Add parent under Students
        students_ref.child(student_id).child("parents").child(parent_id).set({
            "relationship": relationship
        })

    _clear_student_roster_cache(_resolve_requested_school_code())

    return jsonify({
        "success": True,
        "message": "Parent registered successfully",
        "parentId": parent_id,
        "parentUserId": parent_user_id
    })




# like teacher

@app.route("/api/like_post", methods=["POST"])
def like_post():
    data = request.json
    postId = data.get("postId")
    teacherId = data.get("teacherId")

    scope_error = _enforce_current_teacher_scope(
        teacher_key=teacherId,
        message="Post likes are limited to the signed-in teacher.",
    )
    if scope_error is not None:
        return scope_error

    posts_ref = school_reference("Posts")
    post = posts_ref.child(postId).get()

    if not post:
        return jsonify({"error": "Post not found"}), 404

    likes = post.get("likes", {})

    if teacherId in likes:
        # Teacher already liked → unlike
        likes.pop(teacherId)
    else:
        # Add like
        likes[teacherId] = True

    posts_ref.child(postId).update({
        "likes": likes,
        "likeCount": len(likes)
    })

    return jsonify({"success": True, "likeCount": len(likes), "liked": teacherId in likes})



# ===================== SAVE WEEK LESSON PLAN =====================
@app.route('/api/lesson-plans/save-week', methods=['POST'])
def save_week_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or _get_default_academic_year()
        week = data.get('week')
        week_topic = data.get('weekTopic')
        days = data.get('days') or []

        if not teacher_id or week is None:
            return jsonify({'success': False, 'message': 'teacherId and week are required'}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan updates are limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        if not course_id:
            return jsonify({'success': False, 'message': 'courseId is required'}), 400

        # Normalize week key (string)
        week_key = _lesson_plan_week_key(week)

        # Save under a clean course-centric structure: courses/<course_id>/weeks/<week_key>
        course_ref = school_reference('LessonPlans').child(teacher_id).child(academic_year).child('courses').child(course_id)
        lesson_ref = course_ref.child('weeks').child(week_key)

        # Structure to save
        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'week': week,
            'weekKey': week_key,
            'weekTopic': week_topic,
            'days': days,
            'dayCount': len(days),
            'updatedAt': _utc_now_isoformat()
        }

        lesson_ref.set(obj)
        course_ref.child('meta').update({
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'lastUpdatedWeek': week,
            'updatedAt': obj['updatedAt'],
        })

        return jsonify({'success': True, 'message': 'Week plan saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/api/lesson-plans/save-annual', methods=['POST'])
def save_annual_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or _get_default_academic_year()
        annual_rows = data.get('annualRows', [])

        if not teacher_id:
            return jsonify({'success': False, 'message': 'teacherId is required'}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan updates are limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        if not course_id:
            return jsonify({'success': False, 'message': 'courseId is required'}), 400

        # Save under a clean course-centric structure: courses/<course_id>/annual
        lesson_ref = school_reference('LessonPlans').child(teacher_id).child(academic_year).child('courses').child(course_id)

        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'rows': annual_rows,
            'annualRows': annual_rows,
            'rowCount': len(annual_rows),
            'updatedAt': _utc_now_isoformat()
        }

        lesson_ref.child('annual').set(obj)
        lesson_ref.child('meta').update({
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'updatedAt': obj['updatedAt'],
        })

        return jsonify({'success': True, 'message': 'Annual plan saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/lesson-plans/<teacher_id>', methods=['GET'])
def get_lesson_plans(teacher_id):
    try:
        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan access is limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        academic_year = request.args.get('academicYear') or _get_default_academic_year()

        lesson_ref = school_reference('LessonPlans').child(teacher_id).child(academic_year)

        course_id = request.args.get('courseId')
        if course_id:
            course_node = lesson_ref.child('courses').child(course_id).get() or {}
            course_ref = lesson_ref.child('courses').child(course_id)
            normalized, _ = _lesson_plan_migrate_course_node(course_ref, course_node, teacher_id, course_id, academic_year)

            return jsonify({'success': True, 'data': normalized}), 200

        # If no courseId provided, return entire academic year tree
        data = lesson_ref.get() or {}
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/lesson-plans/migrate', methods=['POST'])
def migrate_lesson_plans():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        academic_year = data.get('academicYear') or _get_default_academic_year()
        course_id = data.get('courseId')

        if not teacher_id:
            return jsonify({'success': False, 'message': 'teacherId is required'}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan migration is limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        lesson_ref = school_reference('LessonPlans').child(teacher_id).child(academic_year)
        migrated_courses = []
        migrated_submissions = []

        if course_id:
            course_ref = lesson_ref.child('courses').child(course_id)
            course_node = course_ref.get() or {}
            _, course_changed = _lesson_plan_migrate_course_node(course_ref, course_node, teacher_id, course_id, academic_year)
            if course_changed:
                migrated_courses.append(course_id)

            submissions_ref = school_reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(course_id)
            submission_node = submissions_ref.get() or {}
            _, submissions_changed = _lesson_plan_migrate_submission_entries(submissions_ref, submission_node, teacher_id, course_id, academic_year)
            if submissions_changed:
                migrated_submissions.append(course_id)
        else:
            courses_node = lesson_ref.child('courses').get() or {}
            if isinstance(courses_node, dict):
                for current_course_id, course_node in courses_node.items():
                    if not isinstance(course_node, dict):
                        continue
                    course_ref = lesson_ref.child('courses').child(current_course_id)
                    _, course_changed = _lesson_plan_migrate_course_node(course_ref, course_node, teacher_id, current_course_id, academic_year)
                    if course_changed:
                        migrated_courses.append(current_course_id)

                    submissions_ref = school_reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(current_course_id)
                    submission_node = submissions_ref.get() or {}
                    _, submissions_changed = _lesson_plan_migrate_submission_entries(submissions_ref, submission_node, teacher_id, current_course_id, academic_year)
                    if submissions_changed:
                        migrated_submissions.append(current_course_id)

        return jsonify({
            'success': True,
            'message': 'Lesson plan migration completed',
            'data': {
                'teacherId': teacher_id,
                'academicYear': academic_year,
                'courseId': course_id,
                'migratedCourses': migrated_courses,
                'migratedSubmissions': migrated_submissions,
            }
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ===================== LESSON PLAN SUBMISSIONS (daily) =====================
@app.route('/api/lesson-plans/submissions', methods=['GET'])
def get_lesson_plan_submissions():
    try:
        teacher_id = request.args.get('teacherId')
        course_id = request.args.get('courseId')
        academic_year = request.args.get('academicYear') or _get_default_academic_year()

        if not teacher_id or not course_id:
            return jsonify({'success': False, 'message': 'teacherId and courseId are required'}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan submissions are limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        ref = school_reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(course_id)
        raw_data = ref.get() or {}
        data, _ = _lesson_plan_migrate_submission_entries(ref, raw_data, teacher_id, course_id, academic_year)
        data = data or {}

        results = []
        for child_key, val in (data.items() if isinstance(data, dict) else []):
            if isinstance(val, dict):
                entry = val.copy()
                entry['childKey'] = child_key
                results.append(entry)

        return jsonify({'success': True, 'data': results}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/lesson-plans/submit-daily', methods=['POST'])
def submit_daily_lesson_plan():
    try:
        data = request.get_json() or {}
        teacher_id = data.get('teacherId')
        course_id = data.get('courseId')
        academic_year = data.get('academicYear') or _get_default_academic_year()
        key = data.get('key')
        week = data.get('week')
        day_name = data.get('dayName')
        submitted_at = data.get('submittedAt') or _utc_now_isoformat()

        if not teacher_id or not course_id or not key:
            return jsonify({'success': False, 'message': 'teacherId, courseId and key are required'}), 400

        scope_error = _enforce_current_teacher_scope(
            teacher_key=teacher_id,
            message='Lesson plan submissions are limited to the signed-in teacher.',
        )
        if scope_error is not None:
            return scope_error

        # sanitize child key for RTDB node name
        child = re.sub(r'[^A-Za-z0-9_\-]', '_', str(key))

        base_ref = school_reference('LessonPlanSubmissions').child(teacher_id).child(academic_year).child(course_id)
        existing_root = base_ref.get() or {}
        _lesson_plan_migrate_submission_entries(base_ref, existing_root, teacher_id, course_id, academic_year)
        ref = base_ref.child('entries').child(child)

        existing = ref.get()
        if existing:
            return jsonify({'success': True, 'message': 'Already submitted', 'data': existing}), 200

        obj = {
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'key': key,
            'childKey': child,
            'week': week,
            'dayName': day_name,
            'submittedAt': submitted_at
        }

        ref.set(obj)
        base_ref.child('meta').update({
            'teacherId': teacher_id,
            'courseId': course_id,
            'academicYear': academic_year,
            'updatedAt': submitted_at,
        })

        return jsonify({'success': True, 'message': 'Submission saved', 'data': obj}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500



# ===================== RUN APP =====================
if __name__ == '__main__':
    run_host = str(os.getenv('FLASK_HOST') or os.getenv('HOST') or '127.0.0.1').strip() or '127.0.0.1'
    try:
        run_port = int(os.getenv('FLASK_PORT') or os.getenv('PORT') or '5001')
    except (TypeError, ValueError):
        run_port = 5001

    debug_enabled = _env_flag('FLASK_DEBUG', default=APP_ENV != 'production')
    use_reloader = debug_enabled and _env_flag('FLASK_USE_RELOADER', default=False)
    app.run(host=run_host, port=run_port, debug=debug_enabled, use_reloader=use_reloader)

