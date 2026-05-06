import mimetypes
import os
from functools import lru_cache
import re
import secrets
import string
import time
from urllib.parse import quote
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from werkzeug.exceptions import HTTPException


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CREDENTIAL_FILE = "gojo-education-firebase-adminsdk-fbsvc-dd7c417a41.json"
DEFAULT_DATABASE_URL = "https://gojo-education-default-rtdb.firebaseio.com/"
DEFAULT_STORAGE_BUCKET = "gojo-education.firebasestorage.app"
DEFAULT_PLATFORM_ROOT = "Platform1"
DEFAULT_SCHOOLS_ROOT = "Schools"
LOCAL_UPLOAD_ROOT = os.path.join(BASE_DIR, "uploaded_assets")

DEFAULT_SCHOOL_DEPARTMENTS = {
    "DEP_ACADEMIC": {
        "description": "Handles teaching and learning activities",
        "name": "Academic",
        "status": "active",
    },
    "DEP_FINANCE": {
        "description": "Salary, payments, and budgeting",
        "name": "Finance",
        "status": "active",
    },
    "DEP_HR": {
        "description": "Employee management and operations",
        "name": "Human Resource",
        "status": "active",
    },
    "DEP_MANAGEMENT": {
        "description": "School leadership and decision making",
        "name": "Management",
        "status": "active",
    },
}

DEFAULT_SCHOOL_POSITIONS = {
    "POS_DIRECTOR": {
        "departmentId": "DEP_MANAGEMENT",
        "name": "Director",
    },
    "POS_HR": {
        "departmentId": "DEP_HR",
        "name": "Human Resource",
    },
    "POS_TEACHER": {
        "departmentId": "DEP_ACADEMIC",
        "name": "Teacher",
    },
    "POS_VICE_DIRECTOR": {
        "departmentId": "DEP_MANAGEMENT",
        "name": "Vice Director",
    },
}


app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                r"http://localhost:\d+",
                r"http://127\.0\.0\.1:\d+",
            ]
        }
    },
)


LOCAL_DEV_ORIGIN_PATTERN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


def _credential_path():
    configured = str(os.getenv("FIREBASE_CREDENTIALS", "")).strip()
    if configured:
        return configured
    return os.path.join(BASE_DIR, DEFAULT_CREDENTIAL_FILE)


def _initialize_firebase():
    credential_path = _credential_path()
    if not os.path.exists(credential_path):
        raise FileNotFoundError(
            "Firebase credential JSON not found. Set FIREBASE_CREDENTIALS or place the file in backend/."
        )

    if firebase_admin._apps:
        return firebase_admin.get_app()

    credential = credentials.Certificate(credential_path)
    return firebase_admin.initialize_app(
        credential,
        {
            "databaseURL": os.getenv("FIREBASE_DATABASE_URL", DEFAULT_DATABASE_URL),
            "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET", DEFAULT_STORAGE_BUCKET),
        },
    )


_initialize_firebase()


@lru_cache(maxsize=1)
def platform_ref():
    return db.reference(str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/"))


@lru_cache(maxsize=1)
def schools_ref():
    return platform_ref().child(str(os.getenv("SCHOOLS_ROOT", DEFAULT_SCHOOLS_ROOT)).strip("/"))


@lru_cache(maxsize=1)
def root_ref():
    return db.reference("/")


@lru_cache(maxsize=8)
def _shared_node_scope(node_name):
    platform_node = platform_ref().child(node_name)
    root_node = root_ref().child(node_name)

    platform_snapshot = platform_node.get()
    root_snapshot = root_node.get()

    if platform_snapshot not in (None, {}, []):
        return "platform"
    if root_snapshot not in (None, {}, []):
        return "root"
    if platform_snapshot is not None:
        return "platform"
    return "root"


def _shared_node_ref(node_name):
    if _shared_node_scope(node_name) == "platform":
        return platform_ref().child(node_name)
    return root_ref().child(node_name)


def _shared_node_update_path(node_name, *segments):
    path_segments = []
    if _shared_node_scope(node_name) == "platform":
        path_segments.append(str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/"))

    path_segments.append(str(node_name).strip("/"))
    path_segments.extend(str(segment).strip("/") for segment in segments if str(segment).strip("/"))
    return "/".join(path_segments)


def _platform_child(*segments):
    ref = platform_ref()
    for segment in segments:
        ref = ref.child(str(segment).strip("/"))
    return ref


def company_exams_ref():
    return _platform_child("companyExams")


def legacy_company_exams_ref():
    return root_ref().child("companyExams")


def company_exam_drafts_ref():
    return _platform_child("companyExamDrafts")


def question_banks_ref():
    return _platform_child("questionBanks").child("questionBanks")


def legacy_question_banks_ref():
    return root_ref().child("questionBanks").child("questionBanks")


def app_config_ref():
    return _platform_child("appConfig")


def legacy_app_config_ref():
    return root_ref().child("appConfig")


def textbooks_ref():
    return _platform_child("TextBooks")


def legacy_textbooks_ref():
    return root_ref().child("TextBooks")


def student_progress_ref():
    return _shared_node_ref("studentProgress")


def rankings_update_path(*segments):
    path_segments = [str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/"), "rankings"]
    path_segments.extend(str(segment).strip("/") for segment in segments if str(segment).strip("/"))
    return "/".join(path_segments)


def rankings_ref():
    return platform_ref().child("rankings")


def legacy_schools_ref():
    return root_ref().child("Schools")


def storage_bucket():
    return storage.bucket(os.getenv("FIREBASE_STORAGE_BUCKET", DEFAULT_STORAGE_BUCKET))


TEXTBOOK_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TEXTBOOK_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx"}
TEXTBOOK_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _extract_grade_token(*values):
    for value in values:
        match = re.search(r"G(\d+)", str(value or "").upper())
        if match:
            return f"grade{match.group(1)}"
    return ""


def _extract_subject_key(*values):
    for value in values:
        parts = [part.lower() for part in str(value or "").split("_") if part]
        if len(parts) >= 3:
            return "_".join(parts[2:-1] or parts[2:3])
    return ""


def _normalize_text_list(*values):
    normalized = []
    for value in values:
        if isinstance(value, list):
            normalized.extend(str(item).strip() for item in value if str(item).strip())
        elif isinstance(value, str) and value.strip():
            normalized.append(value.strip())
    return normalized


def _deep_merge_dicts(base, override):
    base = base if isinstance(base, dict) else {}
    override = override if isinstance(override, dict) else {}

    merged = dict(base)
    for key, value in override.items():
        if isinstance(merged.get(key), dict) and isinstance(value, dict):
            merged[key] = _deep_merge_dicts(merged[key], value)
        else:
            merged[key] = value
    return merged


def _non_empty_string(value):
    text = str(value or "").strip()
    return text


def _require_string(value, field_name):
    text = _non_empty_string(value)
    if not text:
        raise ValueError(f"{field_name} is required")
    return text


def _require_key(value, field_name):
    text = _require_string(value, field_name)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", text):
        raise ValueError(f"{field_name} may only contain letters, numbers, underscores, dots, and dashes")
    return text


def _utc_iso_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _current_year_suffix():
    return time.gmtime().tm_year % 100


def _generate_strong_password(length=12):
    if length < 8:
        raise ValueError("Generated password length must be at least 8 characters")

    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    symbols = "!@#$%&*?"
    alphabet = lowercase + uppercase + digits + symbols

    password_chars = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    password_chars.extend(secrets.choice(alphabet) for _ in range(length - len(password_chars)))
    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def _normalize_school_fragment(value):
    return "".join(ch for ch in str(value or "").upper() if ch.isalnum())


def _normalize_school_short_name(value):
    normalized = _normalize_school_fragment(value)
    if not normalized:
        raise ValueError("school.shortName is required")
    return normalized


def _normalize_school_code_segment(value, field_name, length, *, default=""):
    normalized = _normalize_school_fragment(value)
    if not normalized:
        if default:
            return default
        raise ValueError(f"{field_name} is required")
    return normalized[:length]


def _normalize_academic_year_key(value):
    text = _non_empty_string(value)
    if not text:
        current_year = time.gmtime().tm_year
        return f"{current_year}_{current_year + 1}"

    parts = [part for part in re.split(r"[/_-]+", text) if part]
    if len(parts) == 1 and re.fullmatch(r"\d{4}", parts[0]):
        start_year = int(parts[0])
        return f"{start_year}_{start_year + 1}"

    if len(parts) == 2 and all(re.fullmatch(r"\d{4}", part) for part in parts):
        start_year = int(parts[0])
        end_year = int(parts[1])
        if end_year != start_year + 1:
            raise ValueError("school.currentAcademicYear must be sequential, like 2026_2027")
        return f"{start_year}_{end_year}"

    raise ValueError("school.currentAcademicYear must use YYYY_YYYY or YYYY/YYYY")


def _academic_year_label(year_key):
    start_year, end_year = str(year_key or "").split("_", 1)
    return f"{start_year}/{end_year}"


def _payload_bool(payload, key, field_name, default):
    if not isinstance(payload, dict) or key not in payload:
        return default
    return _coerce_bool(payload.get(key), field_name)


def _normalize_boolean_selection(payload, allowed_keys, field_name, defaults=None):
    normalized = dict(defaults or {})

    if isinstance(payload, list):
        payload = {str(item).strip().lower(): True for item in payload if str(item).strip()}

    if not isinstance(payload, dict):
        return normalized

    normalized_payload = {
        str(key or "").strip().lower(): value
        for key, value in payload.items()
    }
    for key in allowed_keys:
        if key in normalized_payload:
            normalized[key] = _coerce_bool(normalized_payload.get(key), f"{field_name}.{key}")

    return normalized


def _preferred_school_language(languages, preferred_value=""):
    preferred = _non_empty_string(preferred_value).lower()
    if preferred in {"am", "amharic"}:
        return "Amharic"
    if preferred in {"om", "oromic", "oromo", "afaan oromo", "afaanoromo"}:
        return "Oromic"
    if preferred in {"en", "english"}:
        return "English"
    if languages.get("am"):
        return "Amharic"
    if languages.get("om"):
        return "Oromic"
    if languages.get("en"):
        return "English"
    return "English"


def _default_school_settings(settings_payload, languages):
    settings_payload = settings_payload if isinstance(settings_payload, dict) else {}
    preferences_payload = settings_payload.get("preferences") if isinstance(settings_payload.get("preferences"), dict) else {}
    security_payload = settings_payload.get("security") if isinstance(settings_payload.get("security"), dict) else {}

    session_timeout = 30
    if "sessionTimeout" in security_payload:
        session_timeout = _coerce_int(
            security_payload.get("sessionTimeout"),
            "school.settings.security.sessionTimeout",
            allow_none=True,
            minimum=5,
        ) or 30

    return {
        "preferences": {
            "dateFormat": _non_empty_string(preferences_payload.get("dateFormat")) or "YYYY-MM-DD",
            "deadlineReminders": _payload_bool(preferences_payload, "deadlineReminders", "school.settings.preferences.deadlineReminders", True),
            "defaultPage": _non_empty_string(preferences_payload.get("defaultPage")) or "/dashboard",
            "emailNotifications": _payload_bool(preferences_payload, "emailNotifications", "school.settings.preferences.emailNotifications", True),
            "language": _preferred_school_language(languages, preferences_payload.get("language")),
            "registrationAlerts": _payload_bool(preferences_payload, "registrationAlerts", "school.settings.preferences.registrationAlerts", True),
            "systemAlerts": _payload_bool(preferences_payload, "systemAlerts", "school.settings.preferences.systemAlerts", True),
            "timeZone": _non_empty_string(preferences_payload.get("timeZone")) or "Africa/Addis_Ababa",
        },
        "security": {
            "sessionTimeout": session_timeout,
            "twoFactorEnabled": _payload_bool(security_payload, "twoFactorEnabled", "school.settings.security.twoFactorEnabled", False),
            "twoFactorSecret": _non_empty_string(security_payload.get("twoFactorSecret")),
        },
    }


def _join_name_parts(*parts):
    return " ".join(part for part in (_non_empty_string(value) for value in parts) if part)


def _default_school_departments():
    return {
        department_id: dict(department_payload)
        for department_id, department_payload in DEFAULT_SCHOOL_DEPARTMENTS.items()
    }


def _default_school_positions():
    return {
        position_id: dict(position_payload)
        for position_id, position_payload in DEFAULT_SCHOOL_POSITIONS.items()
    }


def _build_employee_summary_payload(
    employee_id,
    user_id,
    full_name,
    email,
    phone,
    gender,
    hire_date,
    profile_image,
    department_id,
    position_name,
):
    return {
        "department": department_id,
        "email": email,
        "fullName": full_name,
        "gender": gender,
        "hireDate": hire_date,
        "id": employee_id,
        "phone": phone,
        "position": position_name,
        "profileImage": profile_image,
        "status": "active",
        "userId": user_id,
    }


def _build_school_info_payload(school_payload, school_code, short_name, current_academic_year, created_at_iso, *, strict=True):
    country_name = _non_empty_string(school_payload.get("country")) or "Ethiopia"
    region_name = _require_string(school_payload.get("region"), "school.region") if strict else _non_empty_string(school_payload.get("region"))
    city_name = _require_string(school_payload.get("city"), "school.city") if strict else _non_empty_string(school_payload.get("city"))
    phone = _require_string(school_payload.get("phone"), "school.phone") if strict else _non_empty_string(school_payload.get("phone"))
    email = _require_string(school_payload.get("email"), "school.email") if strict else _non_empty_string(school_payload.get("email"))

    languages = _normalize_boolean_selection(
        school_payload.get("languages"),
        ["am", "en", "om"],
        "school.languages",
        defaults={"am": True, "en": True, "om": False},
    )
    levels = _normalize_boolean_selection(
        school_payload.get("levels"),
        ["preprimary", "elementary", "secondary"],
        "school.levels",
        defaults={"preprimary": False, "elementary": True, "secondary": False},
    )

    return {
        "active": _payload_bool(school_payload, "active", "school.active", True),
        "address": {
            "addressLine": _non_empty_string(school_payload.get("addressLine")),
            "city": city_name,
            "country": country_name,
            "kebele": _non_empty_string(school_payload.get("kebele")),
            "region": region_name,
            "subCity": _non_empty_string(school_payload.get("subCity")),
        },
        "alternativePhone": _non_empty_string(school_payload.get("alternativePhone")),
        "city": city_name,
        "coverImageUrl": _non_empty_string(school_payload.get("coverImageUrl")),
        "createdAt": created_at_iso,
        "currentAcademicYear": current_academic_year,
        "email": email,
        "languages": languages,
        "levels": levels,
        "logoUrl": _non_empty_string(school_payload.get("logoUrl")),
        "name": _require_string(school_payload.get("name"), "school.name"),
        "phone": phone,
        "region": region_name,
        "schoolCode": school_code,
        "settings": _default_school_settings(school_payload.get("settings"), languages),
        "shortName": short_name,
    }


def _build_hr_payload(hr_payload, school_info, school_code, short_name, employee_id, hr_id, user_id, created_at_iso):
    first_name = _require_string(hr_payload.get("firstName"), "hr.firstName")
    middle_name = _non_empty_string(hr_payload.get("middleName"))
    last_name = _require_string(hr_payload.get("lastName"), "hr.lastName")
    email = _require_string(hr_payload.get("email"), "hr.email")
    phone = _require_string(hr_payload.get("phone"), "hr.phone")
    password = _generate_strong_password()
    gender = _non_empty_string(hr_payload.get("gender")) or "male"
    full_name = _join_name_parts(first_name, middle_name, last_name)
    profile_image = _non_empty_string(hr_payload.get("profileImage")) or "/default-profile.png"
    hire_date = created_at_iso[:10]
    position_name = _non_empty_string(hr_payload.get("position")) or "HR Manager"
    department_id = "DEP_HR"

    employee_payload = {
        "contact": {
            "address": _non_empty_string((school_info.get("address") or {}).get("addressLine")),
            "altEmail": _non_empty_string(hr_payload.get("alternativeEmail")),
            "city": school_info.get("city") or "",
            "email": email,
            "phone1": phone,
            "phone2": _non_empty_string(hr_payload.get("alternativePhone")),
            "subCity": _non_empty_string((school_info.get("address") or {}).get("subCity")),
            "woreda": _non_empty_string(hr_payload.get("woreda")),
        },
        "education": {
            "additionalCertifications": "",
            "degreeType": _non_empty_string(hr_payload.get("degreeType")),
            "fieldOfStudy": _non_empty_string(hr_payload.get("fieldOfStudy")),
            "gpa": "",
            "graduationYear": "",
            "highestQualification": _non_empty_string(hr_payload.get("highestQualification")),
            "institution": _non_empty_string(hr_payload.get("institution")),
            "professionalLicenseNumber": "",
            "workExperience": "",
        },
        "employement": {
            "contractEndDate": "",
            "contractStartDate": hire_date,
            "department": _non_empty_string(hr_payload.get("department")) or "Management",
            "employeeCategory": "HR",
            "employmentType": _non_empty_string(hr_payload.get("employmentType")) or "Full-time",
            "hireDate": hire_date,
            "position": position_name,
            "reportingManager": "",
            "status": "Active",
            "workLocation": school_code,
            "workShift": "",
        },
        "family": {
            "childrenNames": "",
            "fatherName": "",
            "maritalStatus": _non_empty_string(hr_payload.get("maritalStatus")),
            "motherName": "",
            "numChildren": "",
            "spouseName": "",
            "spouseOccupation": "",
        },
        "financial": {
            "accountHolderName": "",
            "accountNumber": "",
            "allowances": "",
            "bankBranch": "",
            "bankName": "",
            "basicSalary": "",
            "bonusEligibility": False,
            "overtimeRate": "",
            "paymentMethod": "Bank Transfer",
        },
        "hrId": hr_id,
        "personal": {
            "bloodGroup": "",
            "disabilityStatus": "",
            "dob": _non_empty_string(hr_payload.get("dob")),
            "employeeId": employee_id,
            "firstName": first_name,
            "gender": gender,
            "lastName": last_name,
            "middleName": middle_name,
            "nationalId": _non_empty_string(hr_payload.get("nationalId")),
            "nationality": _non_empty_string((school_info.get("address") or {}).get("country")) or "Ethiopia",
            "password": password,
            "placeOfBirth": school_info.get("city") or "",
            "profileImageName": profile_image,
            "religion": _non_empty_string(hr_payload.get("religion")),
        },
        "userId": user_id,
    }

    user_payload = {
        "email": email,
        "employeeId": employee_id,
        "gender": gender,
        "hrId": hr_id,
        "isActive": True,
        "name": full_name,
        "password": password,
        "phone": phone,
        "profileImage": profile_image,
        "role": "hr",
        "schoolCode": school_code,
        "userId": user_id,
        "username": hr_id,
    }

    role_payload = {
        "employeeId": employee_id,
        "hrId": hr_id,
        "status": "active",
        "userId": user_id,
    }

    return {
        "employee": employee_payload,
        "summary": _build_employee_summary_payload(
            employee_id,
            user_id,
            full_name,
            email,
            phone,
            gender,
            hire_date,
            profile_image,
            department_id,
            position_name,
        ),
        "role": role_payload,
        "user": user_payload,
    }


def _build_registerer_payload(registerer_payload, school_info, school_code, employee_id, registerer_id, user_id, created_at_iso):
    first_name = _require_string(registerer_payload.get("firstName"), "registerer.firstName")
    middle_name = _non_empty_string(registerer_payload.get("middleName"))
    last_name = _require_string(registerer_payload.get("lastName"), "registerer.lastName")
    email = _require_string(registerer_payload.get("email"), "registerer.email")
    phone = _require_string(registerer_payload.get("phone"), "registerer.phone")
    password = _require_string(registerer_payload.get("password"), "registerer.password")
    gender = _non_empty_string(registerer_payload.get("gender")) or "Male"
    profile_image = _non_empty_string(registerer_payload.get("profileImage")) or "/default-profile.png"
    full_name = _join_name_parts(first_name, middle_name, last_name)
    hire_date = created_at_iso[:10]

    contact = {
        "address": _non_empty_string((school_info.get("address") or {}).get("addressLine")),
        "altEmail": _non_empty_string(registerer_payload.get("alternativeEmail")),
        "city": school_info.get("city") or "",
        "email": email,
        "phone1": phone,
        "phone2": _non_empty_string(registerer_payload.get("alternativePhone")),
        "subCity": _non_empty_string((school_info.get("address") or {}).get("subCity")),
        "woreda": _non_empty_string(registerer_payload.get("woreda")),
    }
    education = {
        "additionalCertifications": "",
        "degreeType": _non_empty_string(registerer_payload.get("degreeType")),
        "fieldOfStudy": _non_empty_string(registerer_payload.get("fieldOfStudy")),
        "gpa": "",
        "graduationYear": "",
        "highestQualification": _non_empty_string(registerer_payload.get("highestQualification")),
        "institution": _non_empty_string(registerer_payload.get("institution")),
        "professionalLicenseNumber": "",
        "workExperience": "",
    }
    family = {
        "childrenNames": "",
        "fatherName": "",
        "maritalStatus": "",
        "motherName": "",
        "numChildren": "",
        "spouseName": "",
        "spouseOccupation": "",
    }
    financial = {
        "accountHolderName": "",
        "accountNumber": "",
        "allowances": "",
        "bankBranch": "",
        "bankName": "",
        "basicSalary": "",
        "bonusEligibility": False,
        "overtimeRate": "",
        "paymentMethod": "Bank Transfer",
    }
    job = {
        "contractEndDate": "",
        "contractStartDate": hire_date,
        "department": _non_empty_string(registerer_payload.get("department")) or "Registration",
        "employeeCategory": "Registerer",
        "employmentType": _non_empty_string(registerer_payload.get("employmentType")) or "Full-time",
        "hireDate": hire_date,
        "position": _non_empty_string(registerer_payload.get("position")) or "Registerer",
        "reportingManager": "",
        "status": "Active",
        "workLocation": school_code,
        "workShift": "",
    }
    personal = {
        "bloodGroup": "",
        "disabilityStatus": "",
        "dob": _non_empty_string(registerer_payload.get("dob")),
        "employeeId": employee_id,
        "firstName": first_name,
        "gender": gender,
        "lastName": last_name,
        "middleName": middle_name,
        "nationalId": _non_empty_string(registerer_payload.get("nationalId")),
        "nationality": _non_empty_string((school_info.get("address") or {}).get("country")) or "Ethiopia",
        "password": password,
        "placeOfBirth": school_info.get("city") or "",
        "profileImageName": profile_image,
        "religion": _non_empty_string(registerer_payload.get("religion")),
    }

    employee_payload = {
        "contact": contact,
        "education": education,
        "family": family,
        "financeId": "",
        "financial": financial,
        "gender": gender,
        "hrId": "",
        "job": job,
        "managementId": "",
        "personal": personal,
        "registererId": registerer_id,
        "schoolAdminId": "",
        "teacherId": "",
        "userId": user_id,
    }

    return {
        "employee": employee_payload,
        "node": {
            "employeeId": employee_id,
            "registererId": registerer_id,
            "status": "active",
            "userId": user_id,
        },
        "user": {
            "email": email,
            "employeeId": employee_id,
            "gender": gender,
            "isActive": True,
            "name": full_name,
            "password": password,
            "phone": phone,
            "profileImage": profile_image,
            "registererId": registerer_id,
            "role": "registerer",
            "schoolCode": school_code,
            "userId": user_id,
            "username": registerer_id,
        },
    }


def _school_directory_summary(school_code, school_data):
    school_data = school_data if isinstance(school_data, dict) else {}
    school_info = school_data.get("schoolInfo") if isinstance(school_data.get("schoolInfo"), dict) else {}
    address = school_info.get("address") if isinstance(school_info.get("address"), dict) else {}
    hr_node = school_data.get("HR") if isinstance(school_data.get("HR"), dict) else {}
    registerers_node = school_data.get("Registerers") if isinstance(school_data.get("Registerers"), dict) else {}
    academic_years_node = school_data.get("AcademicYears") if isinstance(school_data.get("AcademicYears"), dict) else {}
    students_node = school_data.get("Students") if isinstance(school_data.get("Students"), dict) else {}
    employees_node = school_data.get("Employees") if isinstance(school_data.get("Employees"), dict) else {}
    teachers_node = school_data.get("Teachers") if isinstance(school_data.get("Teachers"), dict) else {}
    admins_node = school_data.get("School_Admins") if isinstance(school_data.get("School_Admins"), dict) else {}

    return {
        "code": school_code,
        "name": school_info.get("name") or school_data.get("schoolName") or school_code,
        "shortName": school_info.get("shortName") or school_info.get("short_name") or "",
        "active": bool(school_info.get("active")),
        "city": school_info.get("city") or address.get("city") or "",
        "region": school_info.get("region") or address.get("region") or "",
        "phone": school_info.get("phone") or "",
        "alternativePhone": school_info.get("alternativePhone") or "",
        "email": school_info.get("email") or "",
        "currentAcademicYear": school_info.get("currentAcademicYear") or "",
        "createdAt": school_info.get("createdAt") or "",
        "updatedAt": school_info.get("updatedAt") or "",
        "logoUrl": school_info.get("logoUrl") or "",
        "coverImageUrl": school_info.get("coverImageUrl") or "",
        "languages": school_info.get("languages") if isinstance(school_info.get("languages"), dict) else {},
        "levels": school_info.get("levels") if isinstance(school_info.get("levels"), dict) else {},
        "studentCount": len(students_node),
        "employeeCount": len(employees_node),
        "teacherCount": len(teachers_node),
        "adminCount": len(admins_node),
        "hrCount": len(hr_node),
        "registererCount": len(registerers_node),
        "academicYearCount": len(academic_years_node),
    }


def _iter_node_items(node):
    if isinstance(node, dict):
        return list(node.items())
    if isinstance(node, list):
        return [
            (str(index), value)
            for index, value in enumerate(node)
            if value not in (None, {}, [])
        ]
    return []


def _count_node_entries(node):
    return len(_iter_node_items(node))


def _school_storage_scope(school_code):
    platform_school = schools_ref().child(school_code).get()
    if platform_school is not None:
        return platform_school, "platform"

    legacy_school = legacy_schools_ref().child(school_code).get()
    if legacy_school is not None:
        return legacy_school, "root"

    return None, ""


def _extract_grade_label(value):
    text = _non_empty_string(value)
    if not text:
        return ""

    match = re.search(r"(\d+)", text)
    if match:
        return f"Grade {int(match.group(1))}"
    return text.title()


def _extract_student_grade(student_payload):
    if not isinstance(student_payload, dict):
        return ""

    candidate_values = [
        student_payload.get("grade"),
        student_payload.get("gradeLevel"),
        student_payload.get("currentGrade"),
        student_payload.get("gradeName"),
        student_payload.get("classGrade"),
    ]

    academic_payload = student_payload.get("academic") if isinstance(student_payload.get("academic"), dict) else {}
    profile_payload = student_payload.get("profileData") if isinstance(student_payload.get("profileData"), dict) else {}
    personal_payload = profile_payload.get("personal") if isinstance(profile_payload.get("personal"), dict) else {}

    candidate_values.extend(
        [
            academic_payload.get("grade"),
            academic_payload.get("gradeLevel"),
            personal_payload.get("grade"),
        ]
    )

    for value in candidate_values:
        grade_label = _extract_grade_label(value)
        if grade_label:
            return grade_label
    return ""


def _extract_student_gender(student_payload):
    if not isinstance(student_payload, dict):
        return "unspecified"

    profile_payload = student_payload.get("profileData") if isinstance(student_payload.get("profileData"), dict) else {}
    personal_payload = profile_payload.get("personal") if isinstance(profile_payload.get("personal"), dict) else {}
    candidate_values = [
        student_payload.get("gender"),
        personal_payload.get("gender"),
    ]

    for value in candidate_values:
        normalized = _non_empty_string(value).lower()
        if normalized in {"male", "m"}:
            return "male"
        if normalized in {"female", "f"}:
            return "female"
    return "unspecified"


def _school_grade_distribution(students_node):
    grade_counts = {}
    gender_counts = {"male": 0, "female": 0, "unspecified": 0}

    for _, student_payload in _iter_node_items(students_node):
        if not isinstance(student_payload, dict):
            continue

        grade_label = _extract_student_grade(student_payload)
        if grade_label:
            grade_counts[grade_label] = grade_counts.get(grade_label, 0) + 1

        gender_key = _extract_student_gender(student_payload)
        gender_counts[gender_key] = gender_counts.get(gender_key, 0) + 1

    grade_bars = [
        {
            "key": re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or f"grade-{index}",
            "label": label,
            "value": count,
        }
        for index, (label, count) in enumerate(grade_counts.items(), start=1)
    ]
    grade_bars.sort(key=lambda item: (_grade_sort_value(item.get("label")), item.get("label") or ""))

    return grade_bars, gender_counts


def _school_grade_structure_summary(grade_management_node):
    grade_management_node = grade_management_node if isinstance(grade_management_node, dict) else {}
    grades_node = grade_management_node.get("grades") if isinstance(grade_management_node.get("grades"), dict) else {}

    summaries = []
    total_sections = 0
    unique_subjects = set()

    for grade_key, grade_payload in _iter_node_items(grades_node):
        if not isinstance(grade_payload, dict):
            continue

        sections_node = grade_payload.get("sections") if isinstance(grade_payload.get("sections"), dict) else {}
        subjects_node = grade_payload.get("subjects") if isinstance(grade_payload.get("subjects"), dict) else {}
        section_subject_teachers = (
            grade_payload.get("sectionSubjectTeachers") if isinstance(grade_payload.get("sectionSubjectTeachers"), dict) else {}
        )

        subjects_for_grade = set()
        for subject_key, subject_payload in _iter_node_items(subjects_node):
            if isinstance(subject_payload, dict):
                subjects_for_grade.add(_non_empty_string(subject_payload.get("name")) or str(subject_key))
            else:
                subjects_for_grade.add(str(subject_key))

        for _, teacher_payload in _iter_node_items(section_subject_teachers):
            if not isinstance(teacher_payload, dict):
                continue
            for subject_key, subject_payload in _iter_node_items(teacher_payload):
                if isinstance(subject_payload, dict):
                    subjects_for_grade.add(_non_empty_string(subject_payload.get("name")) or str(subject_key))
                else:
                    subjects_for_grade.add(str(subject_key))

        total_sections += _count_node_entries(sections_node)
        unique_subjects.update(subject for subject in subjects_for_grade if subject)
        summaries.append(
            {
                "key": str(grade_key),
                "label": _non_empty_string(grade_payload.get("name")) or _extract_grade_label(grade_key) or str(grade_key),
                "sectionCount": _count_node_entries(sections_node),
                "subjectCount": len(subjects_for_grade),
                "studentCount": 0,
            }
        )

    summaries.sort(key=lambda item: (_grade_sort_value(item.get("label")), item.get("label") or ""))
    return {
        "grades": summaries,
        "gradeCount": len(summaries),
        "sectionCount": total_sections,
        "subjectCount": len(unique_subjects),
    }


def _school_people_directory(role_node, users_node):
    users_node = users_node if isinstance(users_node, dict) else {}
    directory = []

    for role_id, role_payload in _iter_node_items(role_node):
        role_payload = role_payload if isinstance(role_payload, dict) else {}
        user_payload = users_node.get(role_payload.get("userId")) if isinstance(users_node.get(role_payload.get("userId")), dict) else {}
        name = _non_empty_string(user_payload.get("name")) or str(role_id)
        directory.append(
            {
                "id": str(role_id),
                "name": name,
                "email": _non_empty_string(user_payload.get("email")),
                "phone": _non_empty_string(user_payload.get("phone")),
                "profileImage": _non_empty_string(user_payload.get("profileImage")),
                "status": _non_empty_string(role_payload.get("status")) or ("active" if user_payload.get("isActive") else "inactive"),
                "userId": _non_empty_string(role_payload.get("userId")),
            }
        )

    directory.sort(key=lambda item: ((item.get("name") or "").lower(), item.get("id") or ""))
    return directory


def _latest_rollover_summary(rollover_control_node):
    rollover_control_node = rollover_control_node if isinstance(rollover_control_node, dict) else {}
    history_node = rollover_control_node.get("History") if isinstance(rollover_control_node.get("History"), dict) else {}
    latest_entry = None

    for request_id, request_payload in _iter_node_items(history_node):
        if not isinstance(request_payload, dict):
            continue

        created_at = _non_empty_string(request_payload.get("createdAt"))
        if latest_entry is None or created_at > latest_entry.get("createdAt", ""):
            latest_entry = {
                "requestId": str(request_id),
                "status": _non_empty_string(request_payload.get("status")) or "pending",
                "createdAt": created_at,
                "executedAt": _non_empty_string(request_payload.get("executedAt")),
                "targetYear": _non_empty_string(request_payload.get("targetYear")),
                "currentYear": _non_empty_string(request_payload.get("currentYear")),
            }

    return latest_entry or {
        "requestId": "",
        "status": "not-started",
        "createdAt": "",
        "executedAt": "",
        "targetYear": "",
        "currentYear": "",
    }


def _school_detail_payload(school_code, school_data):
    school_data = school_data if isinstance(school_data, dict) else {}
    school_info = school_data.get("schoolInfo") if isinstance(school_data.get("schoolInfo"), dict) else {}
    address = school_info.get("address") if isinstance(school_info.get("address"), dict) else {}
    users_node = school_data.get("Users") if isinstance(school_data.get("Users"), dict) else {}
    students_node = school_data.get("Students") if isinstance(school_data.get("Students"), dict) else {}
    employees_node = school_data.get("Employees") if isinstance(school_data.get("Employees"), dict) else {}
    teachers_node = school_data.get("Teachers") if isinstance(school_data.get("Teachers"), dict) else {}
    hr_node = school_data.get("HR") if isinstance(school_data.get("HR"), dict) else {}
    registerers_node = school_data.get("Registerers") if isinstance(school_data.get("Registerers"), dict) else {}
    admins_node = school_data.get("School_Admins") if isinstance(school_data.get("School_Admins"), dict) else {}
    academic_years_node = school_data.get("AcademicYears") if isinstance(school_data.get("AcademicYears"), dict) else {}
    grade_management_node = school_data.get("GradeManagement") if isinstance(school_data.get("GradeManagement"), dict) else {}
    rollover_control_node = school_data.get("RolloverControl") if isinstance(school_data.get("RolloverControl"), dict) else {}

    grade_bars, gender_counts = _school_grade_distribution(students_node)
    grade_structure = _school_grade_structure_summary(grade_management_node)
    grade_lookup = {item["label"]: item for item in grade_structure["grades"]}
    for grade_bar in grade_bars:
        if grade_bar["label"] in grade_lookup:
            grade_lookup[grade_bar["label"]]["studentCount"] = grade_bar["value"]
        else:
            grade_structure["grades"].append(
                {
                    "key": grade_bar["key"],
                    "label": grade_bar["label"],
                    "sectionCount": 0,
                    "subjectCount": 0,
                    "studentCount": grade_bar["value"],
                }
            )

    grade_structure["grades"].sort(key=lambda item: (_grade_sort_value(item.get("label")), item.get("label") or ""))

    student_count = _count_node_entries(students_node)
    employee_count = _count_node_entries(employees_node)
    teacher_count = _count_node_entries(teachers_node)
    hr_count = _count_node_entries(hr_node)
    registerer_count = _count_node_entries(registerers_node)
    admin_count = _count_node_entries(admins_node)
    academic_year_count = _count_node_entries(academic_years_node)

    population_bars = [
        {"key": "students", "label": "Students", "value": student_count, "tone": "teal"},
        {"key": "employees", "label": "Employees", "value": employee_count, "tone": "gold"},
        {"key": "teachers", "label": "Teachers", "value": teacher_count, "tone": "coral"},
        {"key": "admins", "label": "School Admins", "value": admin_count, "tone": "blue"},
        {"key": "hr", "label": "HR", "value": hr_count, "tone": "teal"},
        {"key": "registerers", "label": "Registerers", "value": registerer_count, "tone": "gold"},
    ]

    location_parts = [
        school_info.get("city") or address.get("city") or "",
        school_info.get("region") or address.get("region") or "",
        address.get("country") or "",
    ]

    return {
        "summary": _school_directory_summary(school_code, school_data),
        "school": {
            "code": school_code,
            "name": school_info.get("name") or school_code,
            "shortName": school_info.get("shortName") or school_info.get("short_name") or "",
            "active": bool(school_info.get("active")),
            "email": school_info.get("email") or "",
            "phone": school_info.get("phone") or "",
            "alternativePhone": school_info.get("alternativePhone") or "",
            "currentAcademicYear": school_info.get("currentAcademicYear") or "",
            "createdAt": school_info.get("createdAt") or "",
            "updatedAt": school_info.get("updatedAt") or "",
            "logoUrl": school_info.get("logoUrl") or "",
            "coverImageUrl": school_info.get("coverImageUrl") or "",
            "country": address.get("country") or "Ethiopia",
            "region": school_info.get("region") or address.get("region") or "",
            "city": school_info.get("city") or address.get("city") or "",
            "subCity": address.get("subCity") or "",
            "kebele": address.get("kebele") or "",
            "addressLine": address.get("addressLine") or "",
            "locationLabel": ", ".join(part for part in location_parts if part),
            "languages": school_info.get("languages") if isinstance(school_info.get("languages"), dict) else {},
            "levels": school_info.get("levels") if isinstance(school_info.get("levels"), dict) else {},
            "settings": school_info.get("settings") if isinstance(school_info.get("settings"), dict) else {},
        },
        "stats": {
            "studentCount": student_count,
            "employeeCount": employee_count,
            "teacherCount": teacher_count,
            "hrCount": hr_count,
            "registererCount": registerer_count,
            "adminCount": admin_count,
            "academicYearCount": academic_year_count,
            "gradeCount": grade_structure["gradeCount"],
            "sectionCount": grade_structure["sectionCount"],
            "subjectCount": grade_structure["subjectCount"],
            "studentTeacherRatio": round(student_count / teacher_count, 1) if teacher_count else None,
            "studentsPerEmployee": round(student_count / employee_count, 1) if employee_count else None,
        },
        "charts": {
            "population": population_bars,
            "grades": grade_structure["grades"],
            "gender": gender_counts,
        },
        "directories": {
            "hr": _school_people_directory(hr_node, users_node),
            "registerers": _school_people_directory(registerers_node, users_node),
        },
        "activity": {
            "academicYears": sorted(
                [
                    {
                        "key": year_key,
                        "label": _non_empty_string(year_payload.get("label")) or _academic_year_label(year_key),
                        "isCurrent": bool(year_payload.get("isCurrent")),
                        "status": _non_empty_string(year_payload.get("status")) or "active",
                        "updatedAt": _non_empty_string(year_payload.get("updatedAt")),
                    }
                    for year_key, year_payload in _iter_node_items(academic_years_node)
                    if isinstance(year_payload, dict)
                ],
                key=lambda item: item.get("key") or "",
                reverse=True,
            ),
            "rollover": _latest_rollover_summary(rollover_control_node),
        },
    }


@app.after_request
def _apply_local_dev_cors_headers(response):
    origin = str(request.headers.get("Origin") or "").strip()
    if origin and LOCAL_DEV_ORIGIN_PATTERN.fullmatch(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.errorhandler(Exception)
def _handle_unexpected_error(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description or error.name}), error.code

    return jsonify({"error": str(error) or "Internal server error"}), 500


def _coerce_int(value, field_name, *, allow_none=False, minimum=None):
    if value is None or value == "":
        if allow_none:
            return None
        raise ValueError(f"{field_name} is required")

    try:
        number = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be an integer") from error

    if minimum is not None and number < minimum:
        raise ValueError(f"{field_name} must be at least {minimum}")
    return number


def _coerce_bool(value, field_name):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    raise ValueError(f"{field_name} must be a boolean")


def _normalize_exam_mode(value, field_name, *, allow_none=False):
    text = _non_empty_string(value).lower()
    if not text:
        if allow_none:
            return ""
        raise ValueError(f"{field_name} is required")
    if text not in {"practice", "competitive", "entrance"}:
        raise ValueError(f"{field_name} must be one of practice, competitive, or entrance")
    return text


def _score_to_points(score_percent):
    try:
        score = float(score_percent)
    except (TypeError, ValueError):
        return 0

    if score >= 90:
        return 4
    if score >= 80:
        return 3
    if score >= 70:
        return 2
    if score >= 60:
        return 1
    return 0


def _optional_timestamp(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_grade_value(value):
    text = str(value or "").strip().lower()
    if not text:
        return ""
    if text.startswith("grade"):
        return text
    match = re.search(r"(\d+)", text)
    if match:
        return f"grade{match.group(1)}"
    return text


def _normalize_textbook_subject_key(value, field_name):
    normalized = re.sub(r"[^a-z0-9]+", "_", _non_empty_string(value).lower()).strip("_")
    if not normalized:
        raise ValueError(f"{field_name} is required")
    return normalized


def _require_grade_key(value, field_name):
    normalized = _normalize_grade_value(value)
    if not normalized:
        raise ValueError(f"{field_name} is required")
    return normalized


def _grade_sort_value(value):
    match = re.search(r"(\d+)", str(value or ""))
    return int(match.group(1)) if match else 999


def _sanitize_storage_segment(value, default_value="file"):
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", _non_empty_string(value)).strip("._")
    return normalized or default_value


def _firebase_storage_download_url(bucket_name, blob_name, token):
    encoded_name = quote(blob_name, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{encoded_name}?alt=media&token={token}"


def _local_uploaded_asset_url(asset_path):
    normalized_path = str(asset_path or "").replace("\\", "/").strip("/")
    encoded_path = quote(normalized_path, safe="/")
    return f"{request.host_url.rstrip('/')}/uploaded-assets/{encoded_path}"


def _validate_image_asset_file(file_storage, asset_label):
    if file_storage is None:
        raise ValueError("file is required")

    original_name = _sanitize_storage_segment(file_storage.filename, "upload")
    extension = os.path.splitext(original_name)[1].lower()
    content_type = _non_empty_string(file_storage.mimetype) or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    is_valid = extension in TEXTBOOK_IMAGE_EXTENSIONS or content_type.startswith("image/")
    if not is_valid:
        raise ValueError(f"{asset_label} uploads must be image files")

    return {
        "fileName": original_name,
        "contentType": content_type,
    }


def _validate_textbook_asset_file(file_storage, asset_type):
    if asset_type == "cover":
        return _validate_image_asset_file(file_storage, "cover")
    if asset_type == "unit":
        if file_storage is None:
            raise ValueError("file is required")

        original_name = _sanitize_storage_segment(file_storage.filename, "upload")
        extension = os.path.splitext(original_name)[1].lower()
        content_type = _non_empty_string(file_storage.mimetype) or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

        is_valid = extension in TEXTBOOK_DOCUMENT_EXTENSIONS or content_type in TEXTBOOK_DOCUMENT_MIME_TYPES
        if not is_valid:
            raise ValueError("unit uploads must be PDF, DOC, or DOCX files")

        return {
            "fileName": original_name,
            "contentType": content_type,
        }

    raise ValueError("assetType must be cover or unit")


def _store_uploaded_asset(file_storage, validated_file, storage_path, local_asset_path):
    download_token = uuid4().hex

    try:
        bucket = storage_bucket()
        blob = bucket.blob(storage_path)
        blob.metadata = {"firebaseStorageDownloadTokens": download_token}
        blob.cache_control = "public, max-age=3600"

        try:
            file_storage.stream.seek(0)
        except (AttributeError, OSError):
            pass

        blob.upload_from_file(file_storage.stream, content_type=validated_file["contentType"])

        blob.metadata = {"firebaseStorageDownloadTokens": download_token}
        blob.patch()

        public_url = ""
        try:
            blob.make_public()
            public_url = blob.public_url
        except Exception:
            public_url = ""

        download_url = _firebase_storage_download_url(bucket.name, storage_path, download_token)
        working_url = public_url or download_url

        return {
            "url": working_url,
            "publicUrl": public_url,
            "downloadUrl": download_url,
            "storageBackend": "firebase",
            "storagePath": storage_path,
            "contentType": validated_file["contentType"],
            "fileName": validated_file["fileName"],
        }
    except Exception as cloud_error:
        local_full_path = os.path.join(LOCAL_UPLOAD_ROOT, *local_asset_path.split("/"))
        os.makedirs(os.path.dirname(local_full_path), exist_ok=True)

        try:
            file_storage.stream.seek(0)
        except (AttributeError, OSError):
            pass

        file_storage.save(local_full_path)
        local_url = _local_uploaded_asset_url(local_asset_path)

        return {
            "url": local_url,
            "publicUrl": local_url,
            "downloadUrl": local_url,
            "storageBackend": "local",
            "storagePath": local_asset_path,
            "contentType": validated_file["contentType"],
            "fileName": validated_file["fileName"],
            "fallbackReason": str(cloud_error),
        }



def _upload_textbook_asset(file_storage, asset_type, grade_key, subject_key, unit_key=""):
    validated_file = _validate_textbook_asset_file(file_storage, asset_type)
    timestamp = int(time.time() * 1000)

    if asset_type == "cover":
        storage_prefix = f"TextBooks/{grade_key}/{subject_key}/cover"
    else:
        storage_prefix = f"TextBooks/{grade_key}/{subject_key}/units/{_sanitize_storage_segment(unit_key, 'unit')}"

    local_asset_path = f"textbooks/{storage_prefix}/{timestamp}_{validated_file['fileName']}"
    storage_path = f"{storage_prefix}/{timestamp}_{validated_file['fileName']}"
    return _store_uploaded_asset(file_storage, validated_file, storage_path, local_asset_path)


def _persist_uploaded_textbook_asset(asset_type, grade_key, subject_key, uploaded_asset, unit_key=""):
    platform_root_key = str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/")
    uploaded_url = _require_string(uploaded_asset.get("url") or uploaded_asset.get("downloadUrl"), "uploaded asset url")

    if asset_type == "cover":
        updates = {
            f"{platform_root_key}/TextBooks/{grade_key}/{subject_key}/coverUrl": uploaded_url,
        }
        root_ref().update(updates)
        return {
            "location": f"Platform1/TextBooks/{grade_key}/{subject_key}/coverUrl",
            "persistedField": "coverUrl",
        }

    normalized_unit_key = _require_key(unit_key or "unit", "unitKey")
    updates = {
        f"{platform_root_key}/TextBooks/{grade_key}/{subject_key}/units/{normalized_unit_key}/pdfUrl": uploaded_url,
    }
    root_ref().update(updates)
    return {
        "location": f"Platform1/TextBooks/{grade_key}/{subject_key}/units/{normalized_unit_key}/pdfUrl",
        "persistedField": "pdfUrl",
        "unitKey": normalized_unit_key,
    }


def _upload_school_asset(file_storage, asset_type, school_short_name=""):
    normalized_asset_type = _non_empty_string(asset_type).lower()
    asset_paths = {
        "logo": "branding/logo",
        "cover": "branding/cover",
        "hr-profile": "profiles/hr",
        "registerer-profile": "profiles/registerer",
    }
    path_suffix = asset_paths.get(normalized_asset_type)
    if not path_suffix:
        raise ValueError("assetType must be logo, cover, hr-profile, or registerer-profile")

    validated_file = _validate_image_asset_file(file_storage, normalized_asset_type)
    timestamp = int(time.time() * 1000)
    safe_short_name = _sanitize_storage_segment(_normalize_school_fragment(school_short_name), "school")

    storage_path = f"Schools/{safe_short_name}/{path_suffix}/{timestamp}_{validated_file['fileName']}"
    local_asset_path = f"schools/{safe_short_name}/{path_suffix}/{timestamp}_{validated_file['fileName']}"
    return _store_uploaded_asset(file_storage, validated_file, storage_path, local_asset_path)


def _upload_company_exam_asset(file_storage, asset_type, package_id="", package_name="", exam_mode="practice"):
    normalized_asset_type = _non_empty_string(asset_type).lower()
    asset_paths = {
        "package-icon": "branding/package-icon",
    }
    path_suffix = asset_paths.get(normalized_asset_type)
    if not path_suffix:
        raise ValueError("assetType must be package-icon")

    normalized_mode = _normalize_exam_mode(exam_mode, "examMode")
    validated_file = _validate_image_asset_file(file_storage, "package icon")
    timestamp = int(time.time() * 1000)
    safe_package_key = _sanitize_storage_segment(package_id or package_name, "package")

    storage_path = f"CompanyExams/{normalized_mode}/{safe_package_key}/{path_suffix}/{timestamp}_{validated_file['fileName']}"
    local_asset_path = f"company-exams/{normalized_mode}/{safe_package_key}/{path_suffix}/{timestamp}_{validated_file['fileName']}"
    return _store_uploaded_asset(file_storage, validated_file, storage_path, local_asset_path)


def _validate_textbook_node(node, default_title=""):
    if not isinstance(node, dict):
        raise ValueError("textbook must be an object")

    units = node.get("units")
    if not isinstance(units, dict) or not units:
        raise ValueError("textbook.units must be a non-empty object")

    validated_units = {}
    for unit_key, unit_payload in units.items():
        normalized_unit_key = _require_key(unit_key, "textbook unit key")
        if not isinstance(unit_payload, dict):
            raise ValueError(f"textbook.units.{normalized_unit_key} must be an object")

        validated_units[normalized_unit_key] = {
            "pdfUrl": _require_string(unit_payload.get("pdfUrl"), f"textbook.units.{normalized_unit_key}.pdfUrl"),
            "title": _require_string(unit_payload.get("title"), f"textbook.units.{normalized_unit_key}.title"),
        }

    return {
        "coverUrl": _non_empty_string(node.get("coverUrl")),
        "language": _require_string(node.get("language"), "textbook.language"),
        "region": _require_string(node.get("region"), "textbook.region"),
        "title": _non_empty_string(node.get("title")) or _non_empty_string(default_title) or "Untitled textbook",
        "units": validated_units,
    }


def _textbook_unit_conflicts(existing_units, incoming_units):
    conflicts = []

    for unit_key in sorted(set(existing_units).intersection(incoming_units)):
        existing_unit = existing_units.get(unit_key) if isinstance(existing_units.get(unit_key), dict) else {}
        incoming_unit = incoming_units.get(unit_key) if isinstance(incoming_units.get(unit_key), dict) else {}

        existing_pdf_url = _non_empty_string(existing_unit.get("pdfUrl"))
        incoming_pdf_url = _non_empty_string(incoming_unit.get("pdfUrl"))

        if existing_pdf_url and incoming_pdf_url and existing_pdf_url != incoming_pdf_url:
            conflicts.append(unit_key)

    return conflicts


def _normalize_textbook_record(grade_key, subject_key, payload):
    payload = payload if isinstance(payload, dict) else {}
    units = payload.get("units") if isinstance(payload.get("units"), dict) else {}
    normalized_units = [
        {
            "unitKey": unit_key,
            "title": unit_payload.get("title") or unit_key,
            "pdfUrl": unit_payload.get("pdfUrl") or "",
        }
        for unit_key, unit_payload in units.items()
        if isinstance(unit_payload, dict)
    ]
    normalized_units.sort(key=lambda item: item["unitKey"])

    document_units = [unit for unit in normalized_units if _non_empty_string(unit.get("pdfUrl"))]
    pdf_units = [
        unit
        for unit in document_units
        if _non_empty_string(unit.get("pdfUrl")).lower().split("?", 1)[0].endswith(".pdf")
    ]

    return {
        "grade": grade_key,
        "subjectKey": subject_key,
        "title": payload.get("title") or subject_key,
        "language": payload.get("language") or "",
        "region": payload.get("region") or "",
        "coverUrl": payload.get("coverUrl") or "",
        "documentCount": len(document_units),
        "pdfUnitCount": len(pdf_units),
        "firstDocumentUrl": document_units[0]["pdfUrl"] if document_units else "",
        "previewPdfUrl": pdf_units[0]["pdfUrl"] if pdf_units else "",
        "unitCount": len(normalized_units),
        "units": normalized_units,
    }


def _textbooks_dashboard():
    snapshot = _deep_merge_dicts(
        legacy_textbooks_ref().get() or {},
        textbooks_ref().get() or {},
    )
    if not isinstance(snapshot, dict):
        snapshot = {}

    textbooks = []
    total_units = 0
    for grade_key, grade_payload in snapshot.items():
        if not isinstance(grade_payload, dict):
            continue

        for subject_key, textbook_payload in grade_payload.items():
            if not isinstance(textbook_payload, dict):
                continue

            normalized_textbook = _normalize_textbook_record(grade_key, subject_key, textbook_payload)
            textbooks.append(normalized_textbook)
            total_units += normalized_textbook["unitCount"]

    textbooks.sort(
        key=lambda item: (
            _grade_sort_value(item.get("grade")),
            item.get("subjectKey") or "",
            item.get("title") or "",
        )
    )

    return {
        "textbooks": textbooks,
        "tree": snapshot,
        "stats": {
            "gradeCount": len([key for key, value in snapshot.items() if isinstance(value, dict)]),
            "textbookCount": len(textbooks),
            "unitCount": total_units,
        },
    }


def _student_directory():
    schools_snapshot = _deep_merge_dicts(
        legacy_schools_ref().get() or {},
        schools_ref().get() or {},
    )

    directory = {}
    if not isinstance(schools_snapshot, dict):
        return directory

    for school_code, school_payload in schools_snapshot.items():
        if not isinstance(school_payload, dict):
            continue

        students_node = school_payload.get("Students")
        if not isinstance(students_node, dict):
            continue

        for student_id, student_payload in students_node.items():
            if not isinstance(student_payload, dict):
                continue

            basic_info = student_payload.get("basicStudentInformation") if isinstance(student_payload.get("basicStudentInformation"), dict) else {}
            resolved_school_code = _non_empty_string(student_payload.get("schoolCode")) or str(school_code)
            student_name = (
                _non_empty_string(basic_info.get("name"))
                or _non_empty_string(student_payload.get("name"))
                or " ".join(
                    part
                    for part in [
                        _non_empty_string(basic_info.get("firstName")),
                        _non_empty_string(basic_info.get("middleName")),
                        _non_empty_string(basic_info.get("lastName")),
                    ]
                    if part
                )
                or str(student_id)
            )

            directory[student_id] = {
                "studentId": str(student_id),
                "studentName": student_name,
                "grade": _normalize_grade_value(basic_info.get("grade") or student_payload.get("grade")),
                "schoolCode": resolved_school_code,
                "section": _non_empty_string(basic_info.get("section") or student_payload.get("section")),
                "academicYear": _non_empty_string(basic_info.get("academicYear") or student_payload.get("academicYear")),
                "gender": _non_empty_string(basic_info.get("gender") or student_payload.get("gender")),
                "studentPhoto": _non_empty_string(basic_info.get("studentPhoto") or student_payload.get("studentPhoto")),
                "studentNodePath": f"Schools/{resolved_school_code}/Students/{student_id}",
                "studentFound": True,
            }

    return directory


def _derive_exam_mode(exam_meta, round_id, exam_id):
    if isinstance(exam_meta, dict):
        normalized_mode = _non_empty_string(exam_meta.get("mode"))
        if normalized_mode:
            normalized_mode = normalized_mode.lower()
            if normalized_mode in {"practice", "competitive", "entrance"}:
                return normalized_mode

    normalized_round_id = str(round_id or "").strip().lower()
    normalized_exam_id = str(exam_id or "").strip().upper()
    if normalized_round_id.startswith("r"):
        return "competitive"
    if normalized_round_id.startswith("e") or "_ENT_" in normalized_exam_id or "ENTRANCE" in normalized_exam_id:
        return "entrance"
    return "practice"


def _student_progress_students():
    progress_snapshot = student_progress_ref().get() or {}
    student_directory = _student_directory()
    exams_by_id = {exam["examId"]: exam for exam in _company_exam_dashboard()["exams"]}

    if not isinstance(progress_snapshot, dict):
        progress_snapshot = {}

    students = []
    for student_id, student_payload in progress_snapshot.items():
        if not isinstance(student_payload, dict):
            continue

        company_payload = student_payload.get("company")
        if not isinstance(company_payload, dict):
            continue

        student_meta = student_directory.get(student_id, {})
        exam_entries = []

        for round_id, round_payload in company_payload.items():
            if not isinstance(round_payload, dict):
                continue

            for exam_id, exam_progress in round_payload.items():
                if not isinstance(exam_progress, dict):
                    continue

                exam_meta = exams_by_id.get(exam_id, {})
                best_score = exam_progress.get("bestScorePercent")
                exam_mode = _derive_exam_mode(exam_meta, round_id, exam_id)
                exam_entries.append(
                    {
                        "roundId": round_id,
                        "examId": exam_id,
                        "title": exam_meta.get("title") or exam_id,
                        "grade": exam_meta.get("grade") or student_meta.get("grade") or "",
                        "subject": exam_meta.get("subject") or "",
                        "mode": exam_mode,
                        "attemptsUsed": exam_progress.get("attemptsUsed") if isinstance(exam_progress.get("attemptsUsed"), int) else 0,
                        "bestScorePercent": best_score if isinstance(best_score, (int, float)) else None,
                        "status": exam_progress.get("status") or "in_progress",
                        "lastAttemptId": exam_progress.get("lastAttemptId") or "",
                        "lastAttemptTimestamp": _optional_timestamp(exam_progress.get("lastAttemptTimestamp")),
                        "lastSubmittedAt": _optional_timestamp(exam_progress.get("lastSubmittedAt")),
                    }
                )

        exam_entries.sort(key=lambda item: (item.get("roundId") or "", item.get("examId") or ""))

        students.append(
            {
                "studentId": student_id,
                "studentName": student_meta.get("studentName") or student_id,
                "schoolCode": student_meta.get("schoolCode") or "",
                "grade": student_meta.get("grade") or "",
                "section": student_meta.get("section") or "",
                "academicYear": student_meta.get("academicYear") or "",
                "gender": student_meta.get("gender") or "",
                "studentPhoto": student_meta.get("studentPhoto") or "",
                "studentNodePath": student_meta.get("studentNodePath") or "",
                "studentFound": bool(student_meta.get("studentFound")),
                "examCount": len(exam_entries),
                "completedCount": sum(1 for item in exam_entries if item.get("status") == "completed"),
                "scoredCount": sum(1 for item in exam_entries if isinstance(item.get("bestScorePercent"), (int, float))),
                "exams": exam_entries,
            }
        )

    students.sort(key=lambda item: (item.get("studentName") or item.get("studentId") or "", item.get("studentId") or ""))

    return {
        "students": students,
        "count": len(students),
        "examEntryCount": sum(item["examCount"] for item in students),
        "completedExamEntryCount": sum(item["completedCount"] for item in students),
        "scoredExamEntryCount": sum(item["scoredCount"] for item in students),
    }


def _find_grade_rankings(rankings_snapshot, grade):
    country_grade = (
        rankings_snapshot.get("country", {})
        .get("Ethiopia", {})
        .get(grade, {})
    )
    country_leaderboard = country_grade.get("leaderboard") if isinstance(country_grade.get("leaderboard"), dict) else {}

    school_rank_entries = {}
    schools_snapshot = rankings_snapshot.get("schools") if isinstance(rankings_snapshot.get("schools"), dict) else {}
    for school_code, school_payload in schools_snapshot.items():
        if not isinstance(school_payload, dict):
            continue
        grade_payload = school_payload.get(grade)
        if not isinstance(grade_payload, dict):
            continue

        leaderboard = grade_payload.get("leaderboard") if isinstance(grade_payload.get("leaderboard"), dict) else None
        if leaderboard is None:
            leaderboard = {
                student_id: value
                for student_id, value in grade_payload.items()
                if isinstance(value, dict)
            }

        for student_id, rank_payload in leaderboard.items():
            if isinstance(rank_payload, dict):
                school_rank_entries[student_id] = {
                    "schoolCode": school_code,
                    "rank": rank_payload.get("rank"),
                    "totalPoints": rank_payload.get("totalPoints"),
                }

    return country_leaderboard, school_rank_entries


def _current_grade_leaderboard(rankings_snapshot, grade):
    country = rankings_snapshot.get("country") if isinstance(rankings_snapshot.get("country"), dict) else {}
    ethiopia = country.get("Ethiopia") if isinstance(country.get("Ethiopia"), dict) else {}
    grade_payload = ethiopia.get(grade) if isinstance(ethiopia.get(grade), dict) else {}
    leaderboard = grade_payload.get("leaderboard") if isinstance(grade_payload.get("leaderboard"), dict) else {}
    return {
        student_id: {
            "rank": payload.get("rank"),
            "totalPoints": int(payload.get("totalPoints") or 0),
        }
        for student_id, payload in leaderboard.items()
        if isinstance(payload, dict)
    }


def _current_school_grade_entries(rankings_snapshot, school_code, grade):
    schools = rankings_snapshot.get("schools") if isinstance(rankings_snapshot.get("schools"), dict) else {}
    school_payload = schools.get(school_code) if isinstance(schools.get(school_code), dict) else {}
    grade_payload = school_payload.get(grade) if isinstance(school_payload.get(grade), dict) else {}

    leaderboard = grade_payload.get("leaderboard") if isinstance(grade_payload.get("leaderboard"), dict) else None
    if isinstance(leaderboard, dict):
        entries = leaderboard
        mode = "leaderboard"
    else:
        entries = {
            student_id: payload
            for student_id, payload in grade_payload.items()
            if isinstance(payload, dict)
        }
        mode = "direct"

    return (
        {
            student_id: {
                "rank": payload.get("rank"),
                "totalPoints": int(payload.get("totalPoints") or 0),
            }
            for student_id, payload in entries.items()
            if isinstance(payload, dict)
        },
        mode,
    )


def _rank_leaderboard(entries):
    ordered = sorted(
        entries.items(),
        key=lambda item: (-int(item[1].get("totalPoints") or 0), item[0]),
    )

    ranked = {}
    previous_points = None
    current_rank = 0
    for index, (student_id, payload) in enumerate(ordered, start=1):
        total_points = int(payload.get("totalPoints") or 0)
        if previous_points != total_points:
            current_rank = index
            previous_points = total_points
        ranked[student_id] = {
            "rank": current_rank,
            "totalPoints": total_points,
        }
    return ranked


def _competitive_scored_results(results, *, grade_filters=None):
    normalized_grade_filters = {
        _normalize_grade_value(grade)
        for grade in (grade_filters or set())
        if _normalize_grade_value(grade)
    }

    filtered_results = []
    for result in results:
        if not isinstance(result, dict):
            continue
        if result.get("mode") != "competitive":
            continue
        if not isinstance(result.get("bestScorePercent"), (int, float)):
            continue

        grade = _normalize_grade_value(result.get("grade"))
        if not grade:
            continue
        if normalized_grade_filters and grade not in normalized_grade_filters:
            continue

        filtered_results.append(result)

    return filtered_results


def _resolve_company_attempt_record(attempts_snapshot, student_id, exam_id, last_attempt_id="", round_id=""):
    student_attempts = attempts_snapshot.get(student_id) if isinstance(attempts_snapshot, dict) and isinstance(attempts_snapshot.get(student_id), dict) else {}
    exam_attempts = student_attempts.get(exam_id) if isinstance(student_attempts.get(exam_id), dict) else {}
    normalized_attempt_id = _non_empty_string(last_attempt_id)
    normalized_round_id = _non_empty_string(round_id)

    if normalized_attempt_id and isinstance(exam_attempts.get(normalized_attempt_id), dict):
        return normalized_attempt_id, exam_attempts.get(normalized_attempt_id)

    best_attempt_id = ""
    best_attempt_payload = None
    best_attempt_timestamp = None

    for attempt_id, attempt_payload in exam_attempts.items():
        if not isinstance(attempt_payload, dict):
            continue
        if normalized_round_id and _non_empty_string(attempt_payload.get("roundId")) != normalized_round_id:
            continue

        attempt_timestamp = _optional_timestamp(attempt_payload.get("endTime"))
        if attempt_timestamp is None:
            attempt_timestamp = _optional_timestamp(attempt_payload.get("startTime"))
        if attempt_timestamp is None:
            attempt_timestamp = -1

        if best_attempt_payload is None or attempt_timestamp > best_attempt_timestamp:
            best_attempt_id = str(attempt_id)
            best_attempt_payload = attempt_payload
            best_attempt_timestamp = attempt_timestamp

    return best_attempt_id, best_attempt_payload





def _submit_company_exam_points(exam_id=None):
    rankings_snapshot = rankings_ref().get() or {}
    dashboard = _company_exam_dashboard()
    results_snapshot = _company_exam_results()
    attempts_snapshot = _shared_node_ref("attempts").child("company").get() or {}
    results_exams_by_id = {
        exam.get("examId"): exam
        for exam in results_snapshot.get("byExam", [])
        if isinstance(exam, dict) and exam.get("examId")
    }
    dashboard_exams_by_id = {
        exam.get("examId"): exam
        for exam in dashboard.get("exams", [])
        if isinstance(exam, dict) and exam.get("examId")
    }
    available_results = results_snapshot.get("results") if isinstance(results_snapshot.get("results"), list) else []

    if not isinstance(attempts_snapshot, dict):
        attempts_snapshot = {}

    attempt_updates = {}
    for student_id, student_attempts in attempts_snapshot.items():
        if not isinstance(student_attempts, dict):
            continue

        for current_exam_id, exam_attempts in student_attempts.items():
            if not isinstance(exam_attempts, dict):
                continue

            current_exam_id = _non_empty_string(current_exam_id)
            if not current_exam_id:
                continue
            if exam_id and current_exam_id != exam_id:
                continue

            exam_meta = dashboard_exams_by_id.get(current_exam_id) or results_exams_by_id.get(current_exam_id) or {}

            for attempt_id, attempt_payload in exam_attempts.items():
                if not isinstance(attempt_payload, dict):
                    continue

                round_id = _non_empty_string(attempt_payload.get("roundId"))
                if _derive_exam_mode(exam_meta, round_id, current_exam_id) != "competitive":
                    continue

                if str(attempt_payload.get("pointsAwarded")).strip().lower() != "pending":
                    continue

                score_percent = attempt_payload.get("scorePercent")
                if not isinstance(score_percent, (int, float)):
                    try:
                        score_percent = float(str(score_percent).strip())
                    except (TypeError, ValueError):
                        continue

                attempt_updates[
                    _shared_node_update_path("attempts", "company", student_id, current_exam_id, attempt_id, "pointsAwarded")
                ] = _score_to_points(score_percent)

    if exam_id and exam_id not in dashboard_exams_by_id and exam_id not in results_exams_by_id and not attempt_updates:
        raise ValueError(f"No exam results found for {exam_id}")

    competitive_results = _competitive_scored_results(available_results)
    filtered_results = [
        result
        for result in competitive_results
        if not exam_id or result.get("examId") == exam_id
    ]

    if exam_id and not filtered_results and not attempt_updates:
        raise ValueError(f"No completed competitive exam results with scores were found for {exam_id}")
    if not filtered_results and not attempt_updates:
        raise ValueError("No completed competitive exam results with scores were found")

    relevant_grades = {
        _normalize_grade_value(result.get("grade"))
        for result in filtered_results
        if _normalize_grade_value(result.get("grade"))
    }

    country_cache = {grade: {} for grade in relevant_grades}
    school_cache = {}
    school_modes = {}
    updates = {}

    for result in _competitive_scored_results(available_results, grade_filters=relevant_grades):
        grade = _normalize_grade_value(result.get("grade"))
        student_id = str(result.get("studentId") or "").strip()
        school_code = _non_empty_string(result.get("schoolCode"))
        points = _score_to_points(result.get("bestScorePercent"))

        if not grade or not student_id:
            continue

        current_country_entry = country_cache[grade].setdefault(student_id, {"rank": None, "totalPoints": 0})
        current_country_entry["totalPoints"] = int(current_country_entry.get("totalPoints") or 0) + points

        if school_code:
            cache_key = (school_code, grade)
            if cache_key not in school_cache:
                _, school_modes[cache_key] = _current_school_grade_entries(rankings_snapshot, school_code, grade)
                school_cache[cache_key] = {}

            current_school_entry = school_cache[cache_key].setdefault(student_id, {"rank": None, "totalPoints": 0})
            current_school_entry["totalPoints"] = int(current_school_entry.get("totalPoints") or 0) + points

    processed_results = 0
    for grade in relevant_grades:
        ranked_entries = _rank_leaderboard(country_cache[grade])
        updates[rankings_update_path("country", "Ethiopia", grade, "leaderboard")] = ranked_entries
        processed_results += len(ranked_entries)

    for school_code, grade in school_cache:
        ranked_entries = _rank_leaderboard(school_cache[(school_code, grade)])
        school_mode = school_modes[(school_code, grade)]
        school_path = rankings_update_path("schools", school_code, grade)
        if school_mode == "leaderboard":
            updates[f"{school_path}/leaderboard"] = ranked_entries
        else:
            updates[school_path] = ranked_entries

    updates.update(attempt_updates)
    updated_attempt_count = len(attempt_updates)

    updates[rankings_update_path("companyExamAwards")] = None

    root_ref().update(updates)
    return {
        "examId": exam_id or "all",
        "processedResultCount": len(filtered_results),
        "updatedGradeCount": len(relevant_grades),
        "updatedSchoolGradeCount": len(school_cache),
        "updatedAttemptCount": updated_attempt_count,
        "writeCount": len(updates),
    }


def _company_exam_results():
    dashboard = _company_exam_dashboard()
    exams_by_id = {exam["examId"]: exam for exam in dashboard["exams"]}
    student_directory = _student_directory()

    progress_snapshot = student_progress_ref().get() or {}
    rankings_snapshot = rankings_ref().get() or {}
    attempts_snapshot = _shared_node_ref("attempts").child("company").get() or {}

    country_cache = {}
    school_cache = {}
    results = []

    if not isinstance(progress_snapshot, dict):
        progress_snapshot = {}
    if not isinstance(attempts_snapshot, dict):
        attempts_snapshot = {}

    for student_id, student_payload in progress_snapshot.items():
        if not isinstance(student_payload, dict):
            continue

        company_payload = student_payload.get("company")
        if not isinstance(company_payload, dict):
            continue

        for round_id, round_payload in company_payload.items():
            if not isinstance(round_payload, dict):
                continue

            for exam_id, exam_progress in round_payload.items():
                if not isinstance(exam_progress, dict):
                    continue

                exam_meta = exams_by_id.get(exam_id, {})
                student_meta = student_directory.get(student_id, {})
                grade = str(exam_meta.get("grade") or "").strip().lower()
                if not grade:
                    grade = _normalize_grade_value(student_meta.get("grade"))
                if grade and grade not in country_cache:
                    country_cache[grade], school_cache[grade] = _find_grade_rankings(rankings_snapshot, grade)

                country_entry = country_cache.get(grade, {}).get(student_id, {}) if grade else {}
                school_entry = school_cache.get(grade, {}).get(student_id, {}) if grade else {}
                best_score = exam_progress.get("bestScorePercent")
                exam_mode = _derive_exam_mode(exam_meta, round_id, exam_id)
                last_attempt_id, last_attempt = _resolve_company_attempt_record(
                    attempts_snapshot,
                    str(student_id),
                    str(exam_id),
                    exam_progress.get("lastAttemptId") or "",
                    round_id,
                )
                last_attempt = last_attempt if isinstance(last_attempt, dict) else {}
                stored_exam_points = last_attempt.get("pointsAwarded") if isinstance(last_attempt.get("pointsAwarded"), (int, float)) else None

                results.append(
                    {
                        "studentId": student_id,
                        "studentName": student_meta.get("studentName") or student_id,
                        "examId": exam_id,
                        "roundId": round_id,
                        "title": exam_meta.get("title") or exam_id,
                        "grade": grade,
                        "subject": exam_meta.get("subject") or "",
                        "mode": exam_mode,
                        "schoolCode": school_entry.get("schoolCode") or student_meta.get("schoolCode"),
                        "bestScorePercent": best_score if isinstance(best_score, (int, float)) else None,
                        "examPoints": _score_to_points(best_score) if exam_mode == "competitive" else None,
                        "storedExamPoints": stored_exam_points,
                        "pointsSubmitted": stored_exam_points is not None,
                        "attemptsUsed": exam_progress.get("attemptsUsed") if isinstance(exam_progress.get("attemptsUsed"), int) else 0,
                        "status": exam_progress.get("status") or "in_progress",
                        "lastAttemptId": last_attempt_id,
                        "lastAttemptTimestamp": _optional_timestamp(exam_progress.get("lastAttemptTimestamp")),
                        "lastSubmittedAt": _optional_timestamp(exam_progress.get("lastSubmittedAt")),
                        "countryRank": country_entry.get("rank"),
                        "countryTotalPoints": country_entry.get("totalPoints"),
                        "schoolRank": school_entry.get("rank"),
                        "schoolTotalPoints": school_entry.get("totalPoints"),
                    }
                )

    results.sort(
        key=lambda item: (
            item.get("examId") or "",
            -(item.get("bestScorePercent") if isinstance(item.get("bestScorePercent"), (int, float)) else -1),
            item.get("studentId") or "",
        )
    )

    by_exam = {}
    for result in results:
        exam_id = result["examId"]
        if exam_id not in by_exam:
            by_exam[exam_id] = {
                "examId": exam_id,
                "title": result["title"],
                "grade": result["grade"],
                "subject": result["subject"],
                "mode": result["mode"],
                "studentCount": 0,
                "completedCount": 0,
                "averageScorePercent": 0,
                "topScorePercent": None,
                "results": [],
            }

        exam_group = by_exam[exam_id]
        exam_group["results"].append(result)
        exam_group["studentCount"] += 1
        if result.get("status") == "completed":
            exam_group["completedCount"] += 1

    for exam_group in by_exam.values():
        scored_results = [
            item["bestScorePercent"]
            for item in exam_group["results"]
            if isinstance(item.get("bestScorePercent"), (int, float))
        ]
        if scored_results:
            exam_group["averageScorePercent"] = round(sum(scored_results) / len(scored_results), 2)
            exam_group["topScorePercent"] = max(scored_results)

    return {
        "pointRules": [
            {"minimumPercent": 90, "points": 4},
            {"minimumPercent": 80, "points": 3},
            {"minimumPercent": 70, "points": 2},
            {"minimumPercent": 60, "points": 1},
        ],
        "results": results,
        "byExam": sorted(by_exam.values(), key=lambda item: item["examId"]),
        "stats": {
            "studentCount": len({item["studentId"] for item in results}),
            "resultCount": len(results),
            "completedCount": sum(1 for item in results if item.get("status") == "completed"),
        },
    }


def _optional_text_list(value, field_name):
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be a list")

    cleaned = []
    for index, item in enumerate(value):
        if item is None:
            if index == 0:
                cleaned.append(None)
            continue
        text = _non_empty_string(item)
        if text:
            cleaned.append(text)
    return cleaned or None


def _optional_positive_int_fields(source, field_names):
    validated = {}
    for field_name in field_names:
        if field_name in source and source.get(field_name) not in (None, ""):
            validated[field_name] = _coerce_int(source.get(field_name), field_name, minimum=0)
    return validated


def _validate_question_bank_node(question_bank_id, node):
    if not isinstance(node, dict):
        raise ValueError("questionBank must be an object")

    metadata = node.get("metadata")
    questions = node.get("questions")
    if not isinstance(metadata, dict):
        raise ValueError("questionBank.metadata must be an object")
    if not isinstance(questions, dict) or not questions:
        raise ValueError("questionBank.questions must be a non-empty object")

    validated_metadata = {
        "chapter": _require_string(metadata.get("chapter"), "questionBank.metadata.chapter"),
        "difficulty": _require_string(metadata.get("difficulty"), "questionBank.metadata.difficulty"),
        "grade": _require_string(metadata.get("grade"), "questionBank.metadata.grade"),
        "subject": _require_string(metadata.get("subject"), "questionBank.metadata.subject"),
        "totalQuestions": _coerce_int(metadata.get("totalQuestions"), "questionBank.metadata.totalQuestions", minimum=1),
    }

    validated_questions = {}
    for question_key, question_payload in questions.items():
        key = _require_key(question_key, f"question key for {question_bank_id}")
        if not isinstance(question_payload, dict):
            raise ValueError(f"questionBank.questions.{key} must be an object")

        question_type = _require_string(question_payload.get("type"), f"questionBank.questions.{key}.type")
        validated_question = {
            "question": _require_string(question_payload.get("question"), f"questionBank.questions.{key}.question"),
            "type": question_type,
            "correctAnswer": _require_string(question_payload.get("correctAnswer"), f"questionBank.questions.{key}.correctAnswer"),
            "marks": _coerce_int(question_payload.get("marks"), f"questionBank.questions.{key}.marks", minimum=1),
        }

        explanation = _non_empty_string(question_payload.get("explanation"))
        if explanation:
            validated_question["explanation"] = explanation

        options = question_payload.get("options")
        if question_type.lower() == "mcq":
            if not isinstance(options, dict) or len(options) < 2:
                raise ValueError(f"questionBank.questions.{key}.options must include at least two choices for mcq questions")

            validated_options = {}
            for option_key, option_value in options.items():
                normalized_option_key = _require_key(option_key, f"questionBank.questions.{key}.options key")
                option_text = _require_string(option_value, f"questionBank.questions.{key}.options.{normalized_option_key}")
                validated_options[normalized_option_key] = option_text

            if validated_question["correctAnswer"] not in validated_options:
                raise ValueError(f"questionBank.questions.{key}.correctAnswer must match an option key")
            validated_question["options"] = validated_options
        elif isinstance(options, dict) and options:
            validated_question["options"] = {
                _require_key(option_key, f"questionBank.questions.{key}.options key"): _require_string(option_value, f"questionBank.questions.{key}.options.{option_key}")
                for option_key, option_value in options.items()
            }

        validated_questions[key] = validated_question

    return {
        "metadata": validated_metadata,
        "questions": validated_questions,
    }


def _validate_exam_node(exam_id, question_bank_id, node):
    if not isinstance(node, dict):
        raise ValueError("exam must be an object")

    validated = {
        "questionBankId": _require_key(node.get("questionBankId"), "exam.questionBankId"),
        "maxAttempts": _coerce_int(node.get("maxAttempts"), "exam.maxAttempts", minimum=1),
        "questionPoolSize": _coerce_int(node.get("questionPoolSize"), "exam.questionPoolSize", minimum=1),
        "rankingEnabled": _coerce_bool(node.get("rankingEnabled"), "exam.rankingEnabled"),
        "scoringEnabled": _coerce_bool(node.get("scoringEnabled"), "exam.scoringEnabled"),
        "timeLimit": _coerce_int(node.get("timeLimit"), "exam.timeLimit", minimum=1),
        "totalQuestions": _coerce_int(node.get("totalQuestions"), "exam.totalQuestions", minimum=1),
    }

    if validated["questionBankId"] != question_bank_id:
        raise ValueError("exam.questionBankId must match questionBankId")

    exam_mode = _normalize_exam_mode(node.get("mode"), "exam.mode", allow_none=True)
    if not exam_mode:
        exam_mode = "competitive" if validated["rankingEnabled"] else "practice"
    validated["mode"] = exam_mode
    validated["rankingEnabled"] = exam_mode == "competitive"

    pass_percent = _coerce_int(node.get("passPercent"), "exam.passPercent", allow_none=True, minimum=0)
    if pass_percent is not None:
        validated["passPercent"] = pass_percent

    attempt_refill_enabled = node.get("attemptRefillEnabled")
    if attempt_refill_enabled is not None:
        validated["attemptRefillEnabled"] = _coerce_bool(attempt_refill_enabled, "exam.attemptRefillEnabled")

    attempt_refill_interval = _coerce_int(
        node.get("attemptRefillIntervalMs"),
        "exam.attemptRefillIntervalMs",
        allow_none=True,
        minimum=1,
    )
    if attempt_refill_interval is not None:
        validated["attemptRefillIntervalMs"] = attempt_refill_interval

    title = _non_empty_string(node.get("title"))
    if title:
        validated["title"] = title

    text_keys = [key for key in ("instructions", "instruction", "rules") if key in node]
    if len(text_keys) > 1:
        raise ValueError("exam may only include one of instructions, instruction, or rules")
    if text_keys:
        text_key = text_keys[0]
        validated_list = _optional_text_list(node.get(text_key), f"exam.{text_key}")
        if validated_list:
            validated[text_key] = validated_list

    scoring = node.get("scoring")
    if scoring is not None:
        if not isinstance(scoring, dict):
            raise ValueError("exam.scoring must be an object")
        validated_scoring = _optional_positive_int_fields(
            scoring,
            ["diamondPercent", "goldPercent", "maxPoints", "platinumPercent"],
        )
        if validated_scoring:
            validated["scoring"] = validated_scoring

    return validated


def _validate_package_node(package_id, exam_id, node):
    if not isinstance(node, dict):
        raise ValueError("package must be an object")

    subjects = node.get("subjects")
    if not isinstance(subjects, dict) or len(subjects) != 1:
        raise ValueError("package.subjects must contain exactly one subject")

    subject_key, subject_payload = next(iter(subjects.items()))
    subject_key = _require_key(subject_key, "package subject key")
    if not isinstance(subject_payload, dict):
        raise ValueError("package subject payload must be an object")

    rounds = subject_payload.get("rounds")
    if not isinstance(rounds, dict) or len(rounds) != 1:
        raise ValueError("package subject rounds must contain exactly one round")

    round_id, round_payload = next(iter(rounds.items()))
    round_id = _require_key(round_id, "package round id")
    if not isinstance(round_payload, dict):
        raise ValueError("package round payload must be an object")

    validated_round = {
        "examId": _require_key(round_payload.get("examId"), "package round examId"),
        "name": _require_string(round_payload.get("name"), "package round name"),
        "status": _require_string(round_payload.get("status"), "package round status"),
    }
    if validated_round["examId"] != exam_id:
        raise ValueError("package round examId must match examId")

    chapter = _non_empty_string(round_payload.get("chapter"))
    if chapter:
        validated_round["chapter"] = chapter

    validated_round.update(
        _optional_positive_int_fields(
            round_payload,
            ["createdAt", "updatedAt", "startTimestamp", "endTimestamp", "resultReleaseTimestamp"],
        )
    )

    validated_package = {
        "active": _coerce_bool(node.get("active"), "package.active"),
        "description": _require_string(node.get("description"), "package.description"),
        "grade": _require_string(node.get("grade"), "package.grade"),
        "name": _require_string(node.get("name"), "package.name"),
        "type": _normalize_exam_mode(node.get("type"), "package.type"),
        "subjects": {
            subject_key: {
                "name": _require_string(subject_payload.get("name"), "package subject name"),
                "rounds": {
                    round_id: validated_round,
                },
            }
        },
    }

    if validated_package["type"] == "entrance":
        validated_package["entranceYear"] = _coerce_int(node.get("entranceYear"), "package.entranceYear", minimum=1900)

    package_icon = _non_empty_string(node.get("packageIcon"))
    if package_icon:
        validated_package["packageIcon"] = package_icon

    return {
        "package": validated_package,
        "subjectKey": subject_key,
        "roundId": round_id,
    }


def _package_updates(platform_root_key, package_id, validated_package, subject_key, round_id):
    package_node = validated_package["package"]
    subject_node = package_node["subjects"][subject_key]
    round_node = subject_node["rounds"][round_id]
    package_base_path = f"{platform_root_key}/companyExams/packages/{package_id}"

    updates = {
        f"{package_base_path}/active": package_node["active"],
        f"{package_base_path}/description": package_node["description"],
        f"{package_base_path}/grade": package_node["grade"],
        f"{package_base_path}/name": package_node["name"],
        f"{package_base_path}/type": package_node["type"],
        f"{package_base_path}/subjects/{subject_key}/name": subject_node["name"],
        f"{package_base_path}/subjects/{subject_key}/rounds/{round_id}": round_node,
    }
    if package_node.get("packageIcon"):
        updates[f"{package_base_path}/packageIcon"] = package_node["packageIcon"]
    if package_node.get("entranceYear"):
        updates[f"{package_base_path}/entranceYear"] = package_node["entranceYear"]
    return updates


def _normalize_question_bank(question_bank_id, payload):
    payload = payload if isinstance(payload, dict) else {}
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    questions = payload.get("questions") if isinstance(payload.get("questions"), dict) else {}
    total_questions = metadata.get("totalQuestions")
    if not isinstance(total_questions, int):
        total_questions = len(questions)

    return {
        "questionBankId": question_bank_id,
        "title": metadata.get("title") or question_bank_id,
        "description": metadata.get("description") or "",
        "grade": metadata.get("grade") or _extract_grade_token(question_bank_id),
        "subject": metadata.get("subject") or _extract_subject_key(question_bank_id),
        "region": metadata.get("region") or "",
        "language": metadata.get("language") or "",
        "totalQuestions": total_questions,
    }


def _normalize_exam(exam_id, payload, normalized_question_banks):
    payload = payload if isinstance(payload, dict) else {}
    question_bank_id = str(payload.get("questionBankId") or "").strip()
    question_bank = normalized_question_banks.get(question_bank_id, {})

    instructions = _normalize_text_list(
        payload.get("instructions"),
        payload.get("instruction"),
        payload.get("rules"),
    )

    grade = _extract_grade_token(exam_id, question_bank_id)
    explicit_mode = _normalize_exam_mode(payload.get("mode"), "exam.mode", allow_none=True)
    ranking_enabled = bool(payload.get("rankingEnabled"))
    max_attempts = payload.get("maxAttempts")
    mode = explicit_mode or ("competitive" if ranking_enabled else "practice")
    if not explicit_mode and grade == "grade12" and not ranking_enabled:
        mode = "entrance"
    ranking_enabled = ranking_enabled or mode == "competitive"

    return {
        "examId": exam_id,
        "questionBankId": question_bank_id,
        "grade": grade,
        "subject": question_bank.get("subject") or _extract_subject_key(exam_id, question_bank_id),
        "title": payload.get("title") or exam_id,
        "mode": mode,
        "maxAttempts": max_attempts if isinstance(max_attempts, int) else 0,
        "timeLimit": payload.get("timeLimit") if isinstance(payload.get("timeLimit"), int) else 0,
        "totalQuestions": payload.get("totalQuestions") if isinstance(payload.get("totalQuestions"), int) else question_bank.get("totalQuestions", 0),
        "questionPoolSize": payload.get("questionPoolSize") if isinstance(payload.get("questionPoolSize"), int) else question_bank.get("totalQuestions", 0),
        "passPercent": payload.get("passPercent") if isinstance(payload.get("passPercent"), int) else None,
        "rankingEnabled": ranking_enabled,
        "scoringEnabled": bool(payload.get("scoringEnabled")),
        "attemptRefillEnabled": bool(payload.get("attemptRefillEnabled")),
        "attemptRefillIntervalMs": payload.get("attemptRefillIntervalMs") if isinstance(payload.get("attemptRefillIntervalMs"), int) else None,
        "instructions": instructions,
    }


def _round_sort_key(round_id):
    match = re.search(r"(\d+)$", str(round_id or ""))
    return (int(match.group(1)) if match else 999, str(round_id or ""))


def _normalize_package(package_id, payload, normalized_exams):
    payload = payload if isinstance(payload, dict) else {}
    package_grade = str(payload.get("grade") or "").strip().lower()
    package_type = _normalize_exam_mode(payload.get("type"), "package.type", allow_none=True) or "practice"
    subjects_node = payload.get("subjects") if isinstance(payload.get("subjects"), dict) else {}

    normalized_subjects = {}
    round_count = 0
    for subject_key, subject_payload in subjects_node.items():
        if not isinstance(subject_payload, dict):
            continue

        rounds_node = subject_payload.get("rounds") if isinstance(subject_payload.get("rounds"), dict) else {}
        normalized_rounds = []
        for round_id, round_payload in rounds_node.items():
            if not isinstance(round_payload, dict):
                continue

            normalized_round = {
                "roundId": round_id,
                "examId": _non_empty_string(round_payload.get("examId")),
                "name": _non_empty_string(round_payload.get("name")) or round_id,
                "status": _non_empty_string(round_payload.get("status")) or "active",
            }

            chapter = _non_empty_string(round_payload.get("chapter"))
            if chapter:
                normalized_round["chapter"] = chapter

            for field_name in ["createdAt", "updatedAt", "startTimestamp", "endTimestamp", "resultReleaseTimestamp"]:
                if isinstance(round_payload.get(field_name), int):
                    normalized_round[field_name] = round_payload[field_name]

            normalized_rounds.append(normalized_round)

        normalized_rounds.sort(key=lambda item: _round_sort_key(item.get("roundId")))
        round_count += len(normalized_rounds)
        normalized_subjects[subject_key] = {
            "subjectKey": subject_key,
            "name": _non_empty_string(subject_payload.get("name")) or subject_key,
            "rounds": normalized_rounds,
        }

    linked_exams = []
    for exam in normalized_exams.values():
        if package_grade and exam.get("grade") != package_grade:
            continue
        if exam.get("mode") != package_type:
            continue
        linked_exams.append(exam)

    linked_exams.sort(key=lambda item: item["examId"])

    return {
        "packageId": package_id,
        "name": payload.get("name") or package_id,
        "description": payload.get("description") or "",
        "grade": package_grade,
        "type": package_type,
        "active": bool(payload.get("active")),
        "packageIcon": payload.get("packageIcon") or "",
        "entranceYear": payload.get("entranceYear") if isinstance(payload.get("entranceYear"), int) else None,
        "examCount": len(linked_exams),
        "examIds": [exam["examId"] for exam in linked_exams],
        "subjectCount": len(normalized_subjects),
        "roundCount": round_count,
        "subjectKeys": sorted(normalized_subjects.keys()),
        "subjects": normalized_subjects,
    }


def _draft_mode_or_default(*values):
    for value in values:
        text = _non_empty_string(value)
        if text in {"practice", "competitive", "entrance"}:
            return text
    return "practice"


def _normalize_exam_draft_manual_ids(value):
    manual_ids = value if isinstance(value, dict) else {}
    return {
        "questionBank": bool(manual_ids.get("questionBank")),
        "exam": bool(manual_ids.get("exam")),
        "package": bool(manual_ids.get("package")),
    }


def _draft_question_counts(questions):
    question_list = questions if isinstance(questions, list) else []
    started_question_count = 0
    saveable_question_count = 0

    for question in question_list:
        if not isinstance(question, dict):
            continue

        question_text = _non_empty_string(question.get("question"))
        option_values = question.get("options") if isinstance(question.get("options"), dict) else {}
        has_option_content = any(_non_empty_string(option_value) for option_value in option_values.values())

        if question_text or has_option_content:
            started_question_count += 1

        if (
            _non_empty_string(question.get("key"))
            and question_text
            and _non_empty_string(question.get("correctAnswer"))
        ):
            saveable_question_count += 1

    return {
        "questionSlotCount": len(question_list),
        "startedQuestionCount": started_question_count,
        "saveableQuestionCount": saveable_question_count,
    }


def _build_company_exam_draft_metadata(form, route_mode):
    form = form if isinstance(form, dict) else {}
    package_payload = form.get("package") if isinstance(form.get("package"), dict) else {}
    round_payload = package_payload.get("round") if isinstance(package_payload.get("round"), dict) else {}
    exam_payload = form.get("exam") if isinstance(form.get("exam"), dict) else {}
    question_bank_payload = form.get("questionBank") if isinstance(form.get("questionBank"), dict) else {}
    metadata_payload = question_bank_payload.get("metadata") if isinstance(question_bank_payload.get("metadata"), dict) else {}
    question_counts = _draft_question_counts(question_bank_payload.get("questions"))

    package_id = _non_empty_string(form.get("packageId"))
    exam_id = _non_empty_string(form.get("examId"))
    question_bank_id = _non_empty_string(form.get("questionBankId"))
    package_name = _non_empty_string(package_payload.get("name")) or package_id or "Untitled draft"
    grade = _non_empty_string(package_payload.get("grade")) or _non_empty_string(metadata_payload.get("grade"))
    subject_key = _non_empty_string(package_payload.get("subjectKey")) or _non_empty_string(metadata_payload.get("subject"))
    subject_name = _non_empty_string(package_payload.get("subjectName")) or _non_empty_string(metadata_payload.get("subject"))
    chapter = _non_empty_string(metadata_payload.get("chapter")) or _non_empty_string(round_payload.get("chapter"))
    round_id = _non_empty_string(package_payload.get("roundId"))
    exam_title = _non_empty_string(exam_payload.get("title")) or _non_empty_string(round_payload.get("name")) or exam_id

    return {
        "packageId": package_id,
        "packageName": package_name,
        "examId": exam_id,
        "examTitle": exam_title,
        "questionBankId": question_bank_id,
        "grade": grade,
        "subjectKey": subject_key,
        "subjectName": subject_name,
        "chapter": chapter,
        "roundId": round_id,
        "label": package_name,
        "routeMode": route_mode,
        **question_counts,
    }


def _normalize_company_exam_draft(draft_id, payload, *, include_editor_state=False):
    payload = payload if isinstance(payload, dict) else {}
    form = payload.get("form") if isinstance(payload.get("form"), dict) else {}
    route_mode = _draft_mode_or_default(
        payload.get("routeMode"),
        (form.get("package") or {}).get("type") if isinstance(form.get("package"), dict) else None,
    )
    created_at = _optional_timestamp(payload.get("createdAt"))
    updated_at = _optional_timestamp(payload.get("updatedAt"))
    now_ms = int(time.time() * 1000)

    if created_at is None:
        created_at = updated_at or now_ms
    if updated_at is None:
        updated_at = created_at

    normalized = {
        "draftId": draft_id,
        "status": "draft",
        "createdAt": created_at,
        "updatedAt": updated_at,
        **_build_company_exam_draft_metadata(form, route_mode),
    }

    if include_editor_state:
        normalized["form"] = form
        normalized["manualIds"] = _normalize_exam_draft_manual_ids(payload.get("manualIds"))

    return normalized


def _compact_company_exam_draft_payload(form, manual_ids, route_mode, created_at, updated_at):
    return {
        "createdAt": created_at,
        "updatedAt": updated_at,
        "routeMode": route_mode,
        "form": form if isinstance(form, dict) else {},
        "manualIds": _normalize_exam_draft_manual_ids(manual_ids),
    }


def _company_exam_dashboard():
    company_exams_snapshot = _deep_merge_dicts(
        legacy_company_exams_ref().get() or {},
        company_exams_ref().get() or {},
    )
    exams_node = company_exams_snapshot.get("exams") if isinstance(company_exams_snapshot.get("exams"), dict) else {}
    packages_node = company_exams_snapshot.get("packages") if isinstance(company_exams_snapshot.get("packages"), dict) else {}

    question_banks_snapshot = _deep_merge_dicts(
        legacy_question_banks_ref().get() or {},
        question_banks_ref().get() or {},
    )
    question_banks = {
        question_bank_id: _normalize_question_bank(question_bank_id, payload)
        for question_bank_id, payload in question_banks_snapshot.items()
    }

    exams = {
        exam_id: _normalize_exam(exam_id, payload, question_banks)
        for exam_id, payload in exams_node.items()
    }

    packages = {
        package_id: _normalize_package(package_id, payload, exams)
        for package_id, payload in packages_node.items()
    }

    exam_config = _deep_merge_dicts(
        legacy_app_config_ref().child("exams").get() or {},
        app_config_ref().child("exams").get() or {},
    )

    return {
        "packages": sorted(packages.values(), key=lambda item: item["name"]),
        "exams": sorted(exams.values(), key=lambda item: item["examId"]),
        "questionBanks": sorted(question_banks.values(), key=lambda item: item["questionBankId"]),
        "config": exam_config,
        "stats": {
            "packageCount": len(packages),
            "examCount": len(exams),
            "questionBankCount": len(question_banks),
            "competitiveExamCount": sum(1 for exam in exams.values() if exam["mode"] == "competitive"),
            "practiceExamCount": sum(1 for exam in exams.values() if exam["mode"] == "practice"),
            "entranceExamCount": sum(1 for exam in exams.values() if exam["mode"] == "entrance"),
            "totalQuestions": sum(question_bank["totalQuestions"] for question_bank in question_banks.values()),
        },
    }


@app.get("/")
def index():
    return jsonify(
        {
            "app": "Gojo Company Backend",
            "status": "ok",
            "service": "gojo_app",
        }
    )


@app.get("/api/health")
def health_check():
    schools_snapshot = schools_ref().get() or {}
    school_count = len(schools_snapshot) if isinstance(schools_snapshot, dict) else 0
    dashboard = _company_exam_dashboard()

    return jsonify(
        {
            "status": "ok",
            "database": "connected",
            "bucket": storage_bucket().name,
            "schoolCount": school_count,
            "companyExamCount": dashboard["stats"]["examCount"],
            "questionBankCount": dashboard["stats"]["questionBankCount"],
        }
    )


@app.get("/api/schools")
def list_schools():
    schools_snapshot = _deep_merge_dicts(
        legacy_schools_ref().get() or {},
        schools_ref().get() or {},
    )

    schools = []
    if isinstance(schools_snapshot, dict):
        for school_code, school_data in schools_snapshot.items():
            if not isinstance(school_data, dict):
                continue
            schools.append(_school_directory_summary(school_code, school_data))

    schools.sort(key=lambda item: ((item.get("name") or "").lower(), item.get("code") or ""))
    return jsonify(
        {
            "schools": schools,
            "count": len(schools),
            "activeCount": sum(1 for school in schools if school.get("active")),
            "hrAccountCount": sum(int(school.get("hrCount") or 0) for school in schools),
            "registererAccountCount": sum(int(school.get("registererCount") or 0) for school in schools),
        }
    )


@app.get("/api/schools/<school_code>")
def school_detail(school_code):
    try:
        school_code = _require_key(school_code, "schoolCode")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    school_data, _ = _school_storage_scope(school_code)
    if school_data is None:
        return jsonify({"error": f"School {school_code} was not found"}), 404

    return jsonify(_school_detail_payload(school_code, school_data))


@app.post("/api/schools/<school_code>")
def update_school(school_code):
    payload = request.get_json(silent=True) or {}

    try:
        school_code = _require_key(school_code, "schoolCode")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    school_data, scope = _school_storage_scope(school_code)
    if school_data is None or not scope:
        return jsonify({"error": f"School {school_code} was not found"}), 404

    school_payload = payload.get("school")
    if not isinstance(school_payload, dict):
        return jsonify({"error": "school must be an object"}), 400

    school_info = school_data.get("schoolInfo") if isinstance(school_data.get("schoolInfo"), dict) else {}
    address = school_info.get("address") if isinstance(school_info.get("address"), dict) else {}
    existing_short_name = _normalize_school_fragment(
        school_info.get("shortName")
        or school_info.get("short_name")
        or school_info.get("shortname")
    )
    if not existing_short_name:
        return jsonify({"error": f"School {school_code} is missing shortName and cannot be edited safely"}), 409

    normalized_payload = {
        "name": school_payload.get("name", school_info.get("name")),
        "country": school_payload.get("country", address.get("country") or "Ethiopia"),
        "region": school_payload.get("region", school_info.get("region") or address.get("region")),
        "city": school_payload.get("city", school_info.get("city") or address.get("city")),
        "subCity": school_payload.get("subCity", address.get("subCity")),
        "kebele": school_payload.get("kebele", address.get("kebele")),
        "addressLine": school_payload.get("addressLine", address.get("addressLine")),
        "phone": school_payload.get("phone", school_info.get("phone")),
        "alternativePhone": school_payload.get("alternativePhone", school_info.get("alternativePhone")),
        "email": school_payload.get("email", school_info.get("email")),
        "currentAcademicYear": school_payload.get("currentAcademicYear", school_info.get("currentAcademicYear")),
        "logoUrl": school_payload.get("logoUrl", school_info.get("logoUrl")),
        "coverImageUrl": school_payload.get("coverImageUrl", school_info.get("coverImageUrl")),
        "active": school_payload.get("active", school_info.get("active", True)),
        "languages": school_payload.get("languages", school_info.get("languages") or {}),
        "levels": school_payload.get("levels", school_info.get("levels") or {}),
        "settings": school_payload.get("settings", school_info.get("settings") or {}),
    }

    updated_at_iso = _utc_iso_now()
    created_at_iso = _non_empty_string(school_info.get("createdAt")) or updated_at_iso

    try:
        current_academic_year = _normalize_academic_year_key(normalized_payload.get("currentAcademicYear"))
        updated_school_info = _build_school_info_payload(
            normalized_payload,
            school_code,
            existing_short_name,
            current_academic_year,
            created_at_iso,
            strict=False,
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    updated_school_info["updatedAt"] = updated_at_iso
    academic_years_node = school_data.get("AcademicYears") if isinstance(school_data.get("AcademicYears"), dict) else {}

    base_path = f"{str(os.getenv('PLATFORM_ROOT', DEFAULT_PLATFORM_ROOT)).strip('/')}/Schools/{school_code}" if scope == "platform" else f"Schools/{school_code}"
    updates = {
        f"{base_path}/schoolInfo": updated_school_info,
    }

    current_year_exists = False
    for year_key, year_payload in _iter_node_items(academic_years_node):
        if not isinstance(year_payload, dict):
            continue
        next_year_payload = {
            **year_payload,
            "isCurrent": year_key == current_academic_year,
            "updatedAt": updated_at_iso,
        }

        if year_key == current_academic_year:
            current_year_exists = True
            next_year_payload.update(
                {
                    "academicYear": current_academic_year,
                    "createdAt": _non_empty_string(year_payload.get("createdAt")) or updated_at_iso,
                    "status": _non_empty_string(year_payload.get("status")) or "active",
                }
            )

        updates[f"{base_path}/AcademicYears/{year_key}"] = next_year_payload

    if not current_year_exists:
        updates[f"{base_path}/AcademicYears/{current_academic_year}"] = {
            "academicYear": current_academic_year,
            "createdAt": updated_at_iso,
            "isCurrent": True,
            "status": "active",
            "updatedAt": updated_at_iso,
        }

    try:
        root_ref().update(updates)
    except Exception as error:
        return jsonify({"error": f"School update failed: {error}"}), 500

    refreshed_school_data, _ = _school_storage_scope(school_code)
    return jsonify(
        {
            "status": "updated",
            "action": "updated",
            "schoolCode": school_code,
            "updatedAt": updated_at_iso,
            "detail": _school_detail_payload(school_code, refreshed_school_data or {}),
        }
    )
    schools = []

    if isinstance(schools_snapshot, dict):
        for school_code, school_data in schools_snapshot.items():
            if not isinstance(school_data, dict):
                continue
            schools.append(_school_directory_summary(school_code, school_data))

    schools.sort(key=lambda item: ((item.get("name") or "").lower(), item.get("code") or ""))
    return jsonify(
        {
            "schools": schools,
            "count": len(schools),
            "activeCount": sum(1 for school in schools if school.get("active")),
            "hrAccountCount": sum(int(school.get("hrCount") or 0) for school in schools),
            "registererAccountCount": sum(int(school.get("registererCount") or 0) for school in schools),
        }
    )


@app.post("/api/schools")
def create_school():
    payload = request.get_json(silent=True) or {}

    try:
        school_payload = payload.get("school")
        hr_payload = payload.get("hr")

        if not isinstance(school_payload, dict):
            raise ValueError("school must be an object")
        if not isinstance(hr_payload, dict):
            raise ValueError("hr must be an object")

        short_name = _normalize_school_short_name(school_payload.get("shortName"))
        school_code = "-".join(
            [
                _normalize_school_code_segment(school_payload.get("countryCode") or school_payload.get("country"), "school.countryCode", 2, default="ET"),
                _normalize_school_code_segment(school_payload.get("regionCode") or school_payload.get("region"), "school.regionCode", 3),
                _normalize_school_code_segment(school_payload.get("cityCode") or school_payload.get("city"), "school.cityCode", 3),
                short_name,
            ]
        )
        current_academic_year = _normalize_academic_year_key(school_payload.get("currentAcademicYear"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    schools_snapshot = _deep_merge_dicts(
        legacy_schools_ref().get() or {},
        schools_ref().get() or {},
    )
    if not isinstance(schools_snapshot, dict):
        schools_snapshot = {}

    school_code_index_snapshot = _platform_child("schoolCodeIndex").get() or {}
    if not isinstance(school_code_index_snapshot, dict):
        school_code_index_snapshot = {}

    if school_code in schools_snapshot:
        return jsonify({"error": f"School {school_code} already exists"}), 409

    indexed_school_code = _non_empty_string(school_code_index_snapshot.get(short_name))
    if indexed_school_code:
        return jsonify({"error": f"Short name {short_name} is already assigned to {indexed_school_code}"}), 409

    for existing_school_code, existing_school_payload in schools_snapshot.items():
        if not isinstance(existing_school_payload, dict):
            continue
        existing_school_info = existing_school_payload.get("schoolInfo") if isinstance(existing_school_payload.get("schoolInfo"), dict) else {}
        existing_short_name = _normalize_school_fragment(
            existing_school_info.get("shortName")
            or existing_school_info.get("short_name")
            or existing_school_info.get("shortname")
        )
        if existing_short_name and existing_short_name == short_name:
            return jsonify({"error": f"Short name {short_name} is already used by {existing_school_code}"}), 409

    school_root_ref = schools_ref().child(school_code)
    users_ref_for_school = school_root_ref.child("Users")
    hr_user_id = users_ref_for_school.push().key
    if not hr_user_id:
        return jsonify({"error": "Unable to allocate Firebase user IDs for the new school"}), 500

    year_suffix = _current_year_suffix()
    hr_employee_id = f"EMP_{1:04d}_{year_suffix:02d}"
    hr_id = f"{short_name}H_{1:04d}_{year_suffix:02d}"
    created_at_iso = _utc_iso_now()

    try:
        school_info = _build_school_info_payload(school_payload, school_code, short_name, current_academic_year, created_at_iso)
        hr_bundle = _build_hr_payload(hr_payload, school_info, school_code, short_name, hr_employee_id, hr_id, hr_user_id, created_at_iso)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    platform_root_key = str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/")
    updates = {
        f"{platform_root_key}/Schools/{school_code}/schoolInfo": school_info,
        f"{platform_root_key}/Schools/{school_code}/AcademicYears/{current_academic_year}": {
            "academicYear": current_academic_year,
            "createdAt": created_at_iso,
            "isCurrent": True,
            "status": "active",
            "updatedAt": created_at_iso,
        },
        f"{platform_root_key}/Schools/{school_code}/Departments": _default_school_departments(),
        f"{platform_root_key}/Schools/{school_code}/Positions": _default_school_positions(),
        f"{platform_root_key}/Schools/{school_code}/Users/{hr_user_id}": hr_bundle["user"],
        f"{platform_root_key}/Schools/{school_code}/Employees/{hr_employee_id}": hr_bundle["employee"],
        f"{platform_root_key}/Schools/{school_code}/EmployeeSummaries/{hr_employee_id}": hr_bundle["summary"],
        f"{platform_root_key}/Schools/{school_code}/HR/{hr_id}": hr_bundle["role"],
        f"{platform_root_key}/Schools/{school_code}/counters": {
            "school_admins_by_school": {
                short_name: 0,
            }
        },
        f"{platform_root_key}/schoolCodeIndex/{short_name}": school_code,
    }

    try:
        root_ref().update(updates)
    except Exception as error:
        return jsonify({"error": f"School creation failed: {error}"}), 500

    return jsonify(
        {
            "status": "created",
            "action": "created",
            "location": f"{platform_root_key}/Schools/{school_code}",
            "writeCount": len(updates),
            "created": {
                "schoolCode": school_code,
                "shortName": short_name,
                "schoolName": school_info.get("name"),
                "currentAcademicYear": current_academic_year,
                "hrId": hr_id,
                "employeeId": hr_employee_id,
                "hrEmployeeId": hr_employee_id,
                "hrUserId": hr_user_id,
            },
        }
    ), 201


@app.get("/api/company-exams/overview")
def company_exams_overview():
    dashboard = _company_exam_dashboard()
    return jsonify(dashboard)


@app.get("/api/company-exams/drafts")
def company_exam_drafts_list():
    mode = _non_empty_string(request.args.get("mode")).lower()
    if mode:
        try:
            mode = _normalize_exam_mode(mode, "mode")
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

    drafts_snapshot = company_exam_drafts_ref().get() or {}
    if not isinstance(drafts_snapshot, dict):
        drafts_snapshot = {}

    drafts = []
    for draft_id, draft_payload in drafts_snapshot.items():
        normalized_draft = _normalize_company_exam_draft(draft_id, draft_payload)
        if mode and normalized_draft["routeMode"] != mode:
            continue
        drafts.append(normalized_draft)

    drafts.sort(key=lambda item: (-int(item.get("updatedAt") or 0), item.get("label") or item.get("draftId") or ""))
    return jsonify({"drafts": drafts, "count": len(drafts)})


@app.get("/api/company-exams/drafts/<draft_id>")
def company_exam_draft_detail(draft_id):
    try:
        draft_id = _require_key(draft_id, "draftId")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    draft_payload = company_exam_drafts_ref().child(draft_id).get()
    if draft_payload is None:
        return jsonify({"error": f"Draft {draft_id} was not found"}), 404

    return jsonify(_normalize_company_exam_draft(draft_id, draft_payload, include_editor_state=True))


@app.get("/api/textbooks")
def textbooks_list():
    return jsonify(_textbooks_dashboard())


@app.get("/uploaded-assets/<path:asset_path>")
def uploaded_assets(asset_path):
    return send_from_directory(LOCAL_UPLOAD_ROOT, asset_path, as_attachment=False)


@app.post("/api/textbooks/upload-asset")
def upload_textbook_asset():
    form_payload = request.form or {}
    file_storage = request.files.get("file")

    try:
        asset_type = _require_string(form_payload.get("assetType"), "assetType").lower()
        grade_key = _require_grade_key(form_payload.get("gradeKey") or form_payload.get("grade"), "gradeKey")
        subject_key = _normalize_textbook_subject_key(form_payload.get("subjectKey") or form_payload.get("subject"), "subjectKey")
        unit_key = _require_key(_non_empty_string(form_payload.get("unitKey")) or "unit", "unitKey")
        uploaded_asset = _upload_textbook_asset(file_storage, asset_type, grade_key, subject_key, unit_key)
        persisted_asset = _persist_uploaded_textbook_asset(asset_type, grade_key, subject_key, uploaded_asset, unit_key)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return jsonify({"error": f"Textbook upload failed: {error}"}), 500

    return jsonify(
        {
            "status": "uploaded",
            "assetType": asset_type,
            "fieldName": "coverUrl" if asset_type == "cover" else "pdfUrl",
            "gradeKey": grade_key,
            "subjectKey": subject_key,
            "unitKey": unit_key if asset_type == "unit" else "",
            "persisted": True,
            **persisted_asset,
            "downloadUrl": uploaded_asset.get("url"),
            **uploaded_asset,
        }
    )


@app.post("/api/schools/upload-asset")
def upload_school_asset():
    form_payload = request.form or {}
    file_storage = request.files.get("file")

    try:
        asset_type = _require_string(form_payload.get("assetType"), "assetType").lower()
        school_short_name = _non_empty_string(form_payload.get("schoolShortName") or form_payload.get("shortName"))
        uploaded_asset = _upload_school_asset(file_storage, asset_type, school_short_name)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return jsonify({"error": f"School asset upload failed: {error}"}), 500

    return jsonify(
        {
            "status": "uploaded",
            "assetType": asset_type,
            "fieldName": "logoUrl" if asset_type == "logo" else "coverImageUrl" if asset_type == "cover" else "profileImage",
            "target": "school" if asset_type in {"logo", "cover"} else "hr" if asset_type == "hr-profile" else "registerer",
            "schoolShortName": _normalize_school_fragment(school_short_name),
            "downloadUrl": uploaded_asset.get("url"),
            **uploaded_asset,
        }
    )


@app.post("/api/company-exams/upload-asset")
def upload_company_exam_asset():
    form_payload = request.form or {}
    file_storage = request.files.get("file")

    try:
        asset_type = _require_string(form_payload.get("assetType"), "assetType").lower()
        exam_mode = _normalize_exam_mode(form_payload.get("examMode") or "practice", "examMode")
        package_id = _non_empty_string(form_payload.get("packageId"))
        package_name = _non_empty_string(form_payload.get("packageName"))
        uploaded_asset = _upload_company_exam_asset(file_storage, asset_type, package_id, package_name, exam_mode)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return jsonify({"error": f"Company exam asset upload failed: {error}"}), 500

    return jsonify(
        {
            "status": "uploaded",
            "assetType": asset_type,
            "fieldName": "packageIcon",
            "target": "package",
            "examMode": exam_mode,
            "packageKey": _sanitize_storage_segment(package_id or package_name, "package"),
            "downloadUrl": uploaded_asset.get("url"),
            **uploaded_asset,
        }
    )


@app.get("/api/company-exams/exams")
def company_exams_list():
    dashboard = _company_exam_dashboard()
    return jsonify({"exams": dashboard["exams"], "count": dashboard["stats"]["examCount"]})


@app.get("/api/company-exams/packages")
def company_packages_list():
    dashboard = _company_exam_dashboard()
    return jsonify({"packages": dashboard["packages"], "count": dashboard["stats"]["packageCount"]})


@app.get("/api/company-exams/question-banks")
def company_question_banks_list():
    dashboard = _company_exam_dashboard()
    return jsonify({
        "questionBanks": dashboard["questionBanks"],
        "count": dashboard["stats"]["questionBankCount"],
    })


@app.get("/api/company-exams/results")
def company_exam_results():
    return jsonify(_company_exam_results())


@app.get("/api/student-progress/students")
def student_progress_students():
    return jsonify(_student_progress_students())


@app.post("/api/company-exams/results/submit-points")
def company_exam_submit_points():
    payload = request.get_json(silent=True) or {}
    exam_id = _non_empty_string(payload.get("examId"))

    try:
        summary = _submit_company_exam_points(exam_id or None)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify({
        "status": "saved",
        "summary": summary,
    })


@app.post("/api/company-exams/drafts/save-record")
def save_company_exam_draft():
    payload = request.get_json(silent=True) or {}

    try:
        form = payload.get("form")
        if not isinstance(form, dict):
            raise ValueError("form must be an object")

        manual_ids = _normalize_exam_draft_manual_ids(payload.get("manualIds"))
        route_mode = _draft_mode_or_default(
            payload.get("routeMode"),
            (form.get("package") or {}).get("type") if isinstance(form.get("package"), dict) else None,
        )

        requested_draft_id = _non_empty_string(payload.get("draftId"))
        draft_id = _require_key(requested_draft_id, "draftId") if requested_draft_id else f"DRAFT_{uuid4().hex[:12].upper()}"
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    existing_draft = company_exam_drafts_ref().child(draft_id).get()
    now_ms = int(time.time() * 1000)
    created_at = _optional_timestamp(existing_draft.get("createdAt")) if isinstance(existing_draft, dict) else None

    draft_payload = _compact_company_exam_draft_payload(
        form,
        manual_ids,
        route_mode,
        created_at or now_ms,
        now_ms,
    )
    normalized_draft = _normalize_company_exam_draft(draft_id, draft_payload, include_editor_state=True)

    platform_root_key = str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/")
    root_ref().update({f"{platform_root_key}/companyExamDrafts/{draft_id}": draft_payload})

    return jsonify(
        {
            "status": "saved",
            "action": "updated" if isinstance(existing_draft, dict) else "created",
            "location": f"{platform_root_key}/companyExamDrafts/{draft_id}",
            "saved": _normalize_company_exam_draft(draft_id, normalized_draft),
        }
    ), 201 if not isinstance(existing_draft, dict) else 200


def _delete_company_exam_draft_response(draft_id):
    try:
        draft_id = _require_key(draft_id, "draftId")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    existing_draft = company_exam_drafts_ref().child(draft_id).get()
    if existing_draft is None:
        return jsonify({"error": f"Draft {draft_id} was not found"}), 404

    platform_root_key = str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/")
    normalized_draft = _normalize_company_exam_draft(draft_id, existing_draft)

    root_ref().update({f"{platform_root_key}/companyExamDrafts/{draft_id}": None})

    return jsonify(
        {
            "status": "deleted",
            "location": f"{platform_root_key}/companyExamDrafts/{draft_id}",
            "deletedDraftId": draft_id,
            "deleted": normalized_draft,
        }
    )


@app.delete("/api/company-exams/drafts/<draft_id>")
def delete_company_exam_draft(draft_id):
    return _delete_company_exam_draft_response(draft_id)


@app.post("/api/company-exams/drafts/<draft_id>/delete")
def delete_company_exam_draft_via_post(draft_id):
    return _delete_company_exam_draft_response(draft_id)


@app.post("/api/textbooks/save-record")
def save_textbook_record():
    payload = request.get_json(silent=True) or {}

    try:
        grade_key = _require_grade_key(payload.get("gradeKey") or payload.get("grade"), "gradeKey")
        subject_key = _normalize_textbook_subject_key(payload.get("subjectKey") or payload.get("subject"), "subjectKey")
        overwrite = _coerce_bool(payload.get("overwrite", False), "overwrite")
        validated_textbook = _validate_textbook_node(payload.get("textbook"), default_title=subject_key)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return jsonify({"error": f"Textbook save failed: {error}"}), 500

    existing_textbook = _deep_merge_dicts(
        legacy_textbooks_ref().child(grade_key).child(subject_key).get() or {},
        textbooks_ref().child(grade_key).child(subject_key).get() or {},
    )
    existing_units = existing_textbook.get("units") if isinstance(existing_textbook.get("units"), dict) else {}
    incoming_units = validated_textbook.get("units") if isinstance(validated_textbook.get("units"), dict) else {}
    conflicting_unit_keys = _textbook_unit_conflicts(existing_units, incoming_units)

    if conflicting_unit_keys and not overwrite:
        return jsonify({
            "error": (
                f"Units already exist for Platform1/TextBooks/{grade_key}/{subject_key}: "
                f"{', '.join(conflicting_unit_keys)}. Use a different unit key or enable overwrite to replace those unit keys."
            )
        }), 409

    saved_textbook = _deep_merge_dicts(existing_textbook, validated_textbook)
    action = "created"
    if existing_textbook:
        action = "updated" if conflicting_unit_keys else "merged"

    updates = {
        f"{str(os.getenv('PLATFORM_ROOT', DEFAULT_PLATFORM_ROOT)).strip('/')}/TextBooks/{grade_key}/{subject_key}": saved_textbook,
    }
    root_ref().update(updates)

    return jsonify(
        {
            "status": "saved",
            "action": action,
            "location": f"Platform1/TextBooks/{grade_key}/{subject_key}",
            "saved": {
                "gradeKey": grade_key,
                "subjectKey": subject_key,
                "unitCount": len(saved_textbook.get("units") or {}),
                "unitKeys": sorted((saved_textbook.get("units") or {}).keys()),
            },
            "writeCount": len(updates),
        }
    ), 201 if action == "created" else 200


@app.post("/api/platform/company-exams/save-record")
def save_company_exam_record():
    payload = request.get_json(silent=True) or {}

    try:
        question_bank_id = _require_key(payload.get("questionBankId"), "questionBankId")
        exam_id = _require_key(payload.get("examId"), "examId")
        package_id = _require_key(payload.get("packageId"), "packageId")
        overwrite = _coerce_bool(payload.get("overwrite", False), "overwrite")
        draft_id = None
        if payload.get("draftId") not in (None, ""):
            draft_id = _require_key(payload.get("draftId"), "draftId")

        validated_question_bank = _validate_question_bank_node(question_bank_id, payload.get("questionBank"))
        validated_exam = _validate_exam_node(exam_id, question_bank_id, payload.get("exam"))
        validated_package = _validate_package_node(package_id, exam_id, payload.get("package"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    existing_question_bank = question_banks_ref().child(question_bank_id).get()
    existing_exam = company_exams_ref().child("exams").child(exam_id).get()
    existing_round = (
        company_exams_ref()
        .child("packages")
        .child(package_id)
        .child("subjects")
        .child(validated_package["subjectKey"])
        .child("rounds")
        .child(validated_package["roundId"])
        .get()
    )

    if not overwrite:
        if existing_question_bank is not None:
            return jsonify({"error": f"questionBankId {question_bank_id} already exists in Platform1"}), 409
        if existing_exam is not None:
            return jsonify({"error": f"examId {exam_id} already exists in Platform1"}), 409
        if existing_round is not None:
            return jsonify({"error": f"round {validated_package['roundId']} already exists for package {package_id}/{validated_package['subjectKey']} in Platform1"}), 409

    platform_root_key = str(os.getenv("PLATFORM_ROOT", DEFAULT_PLATFORM_ROOT)).strip("/")
    updates = {
        f"{platform_root_key}/questionBanks/questionBanks/{question_bank_id}": validated_question_bank,
        f"{platform_root_key}/companyExams/exams/{exam_id}": validated_exam,
    }
    updates.update(
        _package_updates(
            platform_root_key,
            package_id,
            validated_package,
            validated_package["subjectKey"],
            validated_package["roundId"],
        )
    )
    if draft_id:
        updates[f"{platform_root_key}/companyExamDrafts/{draft_id}"] = None

    root_ref().update(updates)

    return jsonify(
        {
            "status": "saved",
            "location": platform_root_key,
            "saved": {
                "questionBankId": question_bank_id,
                "examId": exam_id,
                "packageId": package_id,
                "subjectKey": validated_package["subjectKey"],
                "roundId": validated_package["roundId"],
            },
            "clearedDraftId": draft_id,
            "writeCount": len(updates),
        }
    ), 201




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)