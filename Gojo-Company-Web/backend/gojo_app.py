import os
from functools import lru_cache
import re

from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CREDENTIAL_FILE = "bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json"
DEFAULT_DATABASE_URL = "https://bale-house-rental-default-rtdb.firebaseio.com/"
DEFAULT_STORAGE_BUCKET = "bale-house-rental.appspot.com"
DEFAULT_PLATFORM_ROOT = "Platform1"
DEFAULT_SCHOOLS_ROOT = "Schools"


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


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


def company_exams_ref():
    return root_ref().child("companyExams")


def question_banks_ref():
    return root_ref().child("questionBanks").child("questionBanks")


def app_config_ref():
    return root_ref().child("appConfig")


def storage_bucket():
    return storage.bucket(os.getenv("FIREBASE_STORAGE_BUCKET", DEFAULT_STORAGE_BUCKET))


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
    ranking_enabled = bool(payload.get("rankingEnabled"))
    max_attempts = payload.get("maxAttempts")
    mode = "competitive" if ranking_enabled else "practice"
    if grade == "grade12" and not ranking_enabled:
        mode = "entrance"

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
    package_type = str(payload.get("type") or "practice").strip().lower()

    linked_exams = []
    for exam in normalized_exams.values():
        if package_grade and exam.get("grade") != package_grade:
            continue
        if package_type == "competitive" and not exam.get("rankingEnabled"):
            continue
        if package_type == "practice" and exam.get("rankingEnabled"):
            continue
        if package_type == "practice" and exam.get("mode") == "entrance":
            continue
        if package_type == "practice" and exam.get("maxAttempts", 0) <= 1:
            continue
        if package_type == "competitive" and exam.get("maxAttempts", 0) > 1:
            continue
        if package_type == "practice" or package_type == exam.get("mode") or package_type == "competitive":
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
        "examCount": len(linked_exams),
        "examIds": [exam["examId"] for exam in linked_exams],
    }


def _company_exam_dashboard():
    company_exams_snapshot = company_exams_ref().get() or {}
    exams_node = company_exams_snapshot.get("exams") if isinstance(company_exams_snapshot.get("exams"), dict) else {}
    packages_node = company_exams_snapshot.get("packages") if isinstance(company_exams_snapshot.get("packages"), dict) else {}

    question_banks_snapshot = question_banks_ref().get() or {}
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

    exam_config = app_config_ref().child("exams").get() or {}

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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)