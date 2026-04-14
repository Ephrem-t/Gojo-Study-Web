import mimetypes
import os
from functools import lru_cache
import re
import time
from urllib.parse import quote
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from werkzeug.exceptions import HTTPException


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CREDENTIAL_FILE = "bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json"
DEFAULT_DATABASE_URL = "https://bale-house-rental-default-rtdb.firebaseio.com/"
DEFAULT_STORAGE_BUCKET = "bale-house-rental.appspot.com"
DEFAULT_PLATFORM_ROOT = "Platform1"
DEFAULT_SCHOOLS_ROOT = "Schools"
LOCAL_UPLOAD_ROOT = os.path.join(BASE_DIR, "uploaded_assets")


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


def rankings_ref():
    return _shared_node_ref("rankings")


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


@app.after_request
def _apply_local_dev_cors_headers(response):
    origin = str(request.headers.get("Origin") or "").strip()
    if origin and LOCAL_DEV_ORIGIN_PATTERN.fullmatch(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
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


def _validate_textbook_asset_file(file_storage, asset_type):
    if file_storage is None:
        raise ValueError("file is required")

    original_name = _sanitize_storage_segment(file_storage.filename, "upload")
    extension = os.path.splitext(original_name)[1].lower()
    content_type = _non_empty_string(file_storage.mimetype) or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    if asset_type == "cover":
        is_valid = extension in TEXTBOOK_IMAGE_EXTENSIONS or content_type.startswith("image/")
        if not is_valid:
            raise ValueError("cover uploads must be image files")
    elif asset_type == "unit":
        is_valid = extension in TEXTBOOK_DOCUMENT_EXTENSIONS or content_type in TEXTBOOK_DOCUMENT_MIME_TYPES
        if not is_valid:
            raise ValueError("unit uploads must be PDF, DOC, or DOCX files")
    else:
        raise ValueError("assetType must be cover or unit")

    return {
        "fileName": original_name,
        "contentType": content_type,
    }


def _upload_textbook_asset(file_storage, asset_type, grade_key, subject_key, unit_key=""):
    validated_file = _validate_textbook_asset_file(file_storage, asset_type)
    timestamp = int(time.time() * 1000)

    if asset_type == "cover":
        storage_prefix = f"TextBooks/{grade_key}/{subject_key}/cover"
    else:
        storage_prefix = f"TextBooks/{grade_key}/{subject_key}/units/{_sanitize_storage_segment(unit_key, 'unit')}"

    local_asset_path = f"textbooks/{storage_prefix}/{timestamp}_{validated_file['fileName']}"

    blob_name = f"{storage_prefix}/{timestamp}_{validated_file['fileName']}"
    download_token = uuid4().hex
    try:
        bucket = storage_bucket()
        blob = bucket.blob(blob_name)
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

        download_url = _firebase_storage_download_url(bucket.name, blob_name, download_token)
        working_url = public_url or download_url

        return {
            "url": working_url,
            "publicUrl": public_url,
            "downloadUrl": download_url,
            "storageBackend": "firebase",
            "storagePath": blob_name,
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


def _validate_textbook_node(node):
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
        "coverUrl": _require_string(node.get("coverUrl"), "textbook.coverUrl"),
        "language": _require_string(node.get("language"), "textbook.language"),
        "region": _require_string(node.get("region"), "textbook.region"),
        "title": _require_string(node.get("title"), "textbook.title"),
        "units": validated_units,
    }


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





def _submit_company_exam_points(exam_id=None):
    rankings_snapshot = rankings_ref().get() or {}
    results_snapshot = _company_exam_results()
    exams_by_id = {
        exam.get("examId"): exam
        for exam in results_snapshot.get("byExam", [])
        if isinstance(exam, dict) and exam.get("examId")
    }
    available_results = results_snapshot.get("results") if isinstance(results_snapshot.get("results"), list) else []

    if exam_id and exam_id not in exams_by_id:
        raise ValueError(f"No exam results found for {exam_id}")

    if exam_id and exams_by_id.get(exam_id, {}).get("mode") != "competitive":
        raise ValueError("Only competitive exam scores can be converted to points")

    competitive_results = _competitive_scored_results(available_results)
    filtered_results = [
        result
        for result in competitive_results
        if not exam_id or result.get("examId") == exam_id
    ]

    if exam_id and not filtered_results:
        raise ValueError(f"No completed competitive exam results with scores were found for {exam_id}")
    if not filtered_results:
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
        updates[_shared_node_update_path("rankings", "country", "Ethiopia", grade, "leaderboard")] = ranked_entries
        processed_results += len(ranked_entries)

    for school_code, grade in school_cache:
        ranked_entries = _rank_leaderboard(school_cache[(school_code, grade)])
        school_mode = school_modes[(school_code, grade)]
        school_path = _shared_node_update_path("rankings", "schools", school_code, grade)
        if school_mode == "leaderboard":
            updates[f"{school_path}/leaderboard"] = ranked_entries
        else:
            updates[school_path] = ranked_entries

    updates[_shared_node_update_path("rankings", "companyExamAwards")] = None

    root_ref().update(updates)
    return {
        "examId": exam_id or "all",
        "processedResultCount": len(filtered_results),
        "updatedGradeCount": len(relevant_grades),
        "updatedSchoolGradeCount": len(school_cache),
        "writeCount": len(updates),
    }


def _company_exam_results():
    dashboard = _company_exam_dashboard()
    exams_by_id = {exam["examId"]: exam for exam in dashboard["exams"]}
    student_directory = _student_directory()

    progress_snapshot = student_progress_ref().get() or {}
    rankings_snapshot = rankings_ref().get() or {}

    country_cache = {}
    school_cache = {}
    results = []

    if not isinstance(progress_snapshot, dict):
        progress_snapshot = {}

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
                exam_mode = exam_meta.get("mode") or "practice"

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
                        "storedExamPoints": None,
                        "pointsSubmitted": False,
                        "attemptsUsed": exam_progress.get("attemptsUsed") if isinstance(exam_progress.get("attemptsUsed"), int) else 0,
                        "status": exam_progress.get("status") or "in_progress",
                        "lastAttemptId": exam_progress.get("lastAttemptId") or "",
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


def _normalize_package(package_id, payload, normalized_exams):
    payload = payload if isinstance(payload, dict) else {}
    package_grade = str(payload.get("grade") or "").strip().lower()
    package_type = _normalize_exam_mode(payload.get("type"), "package.type", allow_none=True) or "practice"

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
    schools_snapshot = schools_ref().get() or {}
    schools = []

    if isinstance(schools_snapshot, dict):
        for school_code, school_data in schools_snapshot.items():
            if not isinstance(school_data, dict):
                continue

            school_info = school_data.get("schoolInfo") or {}
            schools.append(
                {
                    "code": school_code,
                    "name": school_info.get("name") or school_data.get("schoolName") or school_code,
                    "shortName": school_info.get("shortName") or school_info.get("short_name") or "",
                }
            )

    schools.sort(key=lambda item: item["name"])
    return jsonify({"schools": schools, "count": len(schools)})


@app.get("/api/company-exams/overview")
def company_exams_overview():
    dashboard = _company_exam_dashboard()
    return jsonify(dashboard)


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
        unit_key = _non_empty_string(form_payload.get("unitKey")) or "unit"
        uploaded_asset = _upload_textbook_asset(file_storage, asset_type, grade_key, subject_key, unit_key)
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


@app.post("/api/textbooks/save-record")
def save_textbook_record():
    payload = request.get_json(silent=True) or {}

    try:
        grade_key = _require_grade_key(payload.get("gradeKey") or payload.get("grade"), "gradeKey")
        subject_key = _normalize_textbook_subject_key(payload.get("subjectKey") or payload.get("subject"), "subjectKey")
        overwrite = _coerce_bool(payload.get("overwrite", False), "overwrite")
        validated_textbook = _validate_textbook_node(payload.get("textbook"))
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
    conflicting_unit_keys = sorted(set(existing_units).intersection(incoming_units))

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
            "writeCount": len(updates),
        }
    ), 201




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)