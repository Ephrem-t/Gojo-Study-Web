import json
import os
import re
import sys
from datetime import datetime
from flask import Flask, request, jsonify, render_template, has_request_context
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials

# ---------------- FLASK APP ----------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# ---------------- FIREBASE ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
firebase_json = require_firebase_credentials()

if not os.path.exists(firebase_json):
    print(f"Firebase JSON missing at {firebase_json}")
    sys.exit(1)

cred = credentials.Certificate(firebase_json)
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
    "StudentNotes",
    "LessonPlans",
    "LessonPlanSubmissions",
    "Presence",
    "Curriculum",
    "Exams",
    "counters",
    "Users_counters",
}


def _read_school_code_from_request():
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
        'updatedAt': meta_node.get('updatedAt') or datetime.utcnow().isoformat(),
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

        year = datetime.utcnow().year
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
                student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
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

        year = datetime.utcnow().year
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
                student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
                break
    except Exception as e:
        # fallback if transaction fails
        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        student_id = f"GES_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"

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

        year = datetime.utcnow().year
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
                teacher_id = f"{school_short_name}T_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"
                break
    except Exception:
        year = datetime.utcnow().year
        year_suffix = str(year)[-2:]
        teacher_id = f"{school_short_name}T_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suffix}"

    # final username: either provided_username or teacher_id
    username = provided_username or teacher_id

    # create Users entry (push key)
    new_user_ref = users_ref.push()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,  # TODO: hash before production
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

    if teacher_user.get("password") != password:
        return jsonify({"success": False, "message": "Invalid password"}), 401

    teacher_record = all_teachers.get(teacher_key, {}) or {}
    profile_image = (
        teacher_user.get("profileImage")
        or teacher_user.get("profile")
        or teacher_record.get("profileImage")
        or teacher_record.get("profile")
        or "/default-profile.png"
    )

    return jsonify({
        "success": True,
        "teacher": {
            "teacherKey": teacher_key,
            "userId": teacher_user_id,
            "name": teacher_user.get("name"),
            "username": teacher_user.get("username"),
            "profileImage": profile_image,
            "schoolCode": school_code,
            "teacherId": teacher_key,
        }
    })


@app.route("/api/teacher_context", methods=["GET"])
def teacher_context():
    teacher_id = str(request.args.get("teacherId") or "").strip()
    user_id = str(request.args.get("userId") or "").strip()

    inferred_school_code = _resolve_school_code_by_short_name(_extract_short_name_from_teacher_id(teacher_id)) if teacher_id else ""
    search_codes = []
    if inferred_school_code:
        search_codes.append(inferred_school_code)
    search_codes.extend(code for code in _list_school_codes() if code not in search_codes)

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


# ===================== GET STUDENTS OF A COURSE =====================
@app.route('/api/course/<course_id>/students', methods=['GET'])
def get_course_students(course_id):
    courses_ref = school_reference('Courses')
    students_ref = school_reference('Students')
    users_ref = school_reference('Users')
    marks_ref = school_reference('ClassMarks')

    course = courses_ref.child(course_id).get()
    if not course:
        return jsonify({'students': [], 'course': None})

    grade = course.get('grade')
    section = course.get('section')

    all_students = students_ref.get() or {}
    all_users = users_ref.get() or {}
    course_students = []

    for student_id, student in all_students.items():
        if student.get('grade') == grade and student.get('section') == section:
            user_data = all_users.get(student.get('userId'))
            if user_data:
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}
                course_students.append({
                    'studentId': student_id,
                    'name': user_data.get('name'),
                    'username': user_data.get('username'),
                    'marks': {
                        'mark20': student_marks.get('mark20', 0),
                        'mark30': student_marks.get('mark30', 0),
                        'mark50': student_marks.get('mark50', 0),
                        'mark100': student_marks.get('mark100', 0)
                    }
                })

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
        "createdAt": datetime.utcnow().isoformat(),
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
            'updatedAt': datetime.utcnow().isoformat()
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
            'updatedAt': datetime.utcnow().isoformat()
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
        submitted_at = data.get('submittedAt') or datetime.utcnow().isoformat()

        if not teacher_id or not course_id or not key:
            return jsonify({'success': False, 'message': 'teacherId, courseId and key are required'}), 400

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
    app.run(host='127.0.0.1', port=5001, debug=True, use_reloader=False)

