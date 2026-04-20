import argparse
import json
import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, db


BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials


DEFAULT_CREDENTIALS = FIREBASE_CREDENTIALS


def normalize_course_fragment(value):
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value or "").strip())
    return "_".join(part for part in cleaned.split("_") if part)


def build_course_id(grade, section, subject):
    return f"course_{normalize_course_fragment(subject)}_{str(grade or '').strip()}{str(section or '').strip().upper()}"


def humanize_subject(value):
    parts = normalize_course_fragment(value).split("_")
    return " ".join(part.capitalize() for part in parts if part)


def course_matches(course_data, grade, section, subject):
    return (
        str(course_data.get("grade") or "").strip() == str(grade or "").strip()
        and str(course_data.get("section") or course_data.get("secation") or "").strip().upper() == str(section or "").strip().upper()
        and normalize_course_fragment(course_data.get("subject") or course_data.get("name") or "") == normalize_course_fragment(subject)
    )


def resolve_course_id(courses, grade, section, subject):
    fallback_id = build_course_id(grade, section, subject)
    if fallback_id in courses:
        return fallback_id

    for course_id, course_data in courses.items():
        if isinstance(course_data, dict) and course_matches(course_data, grade, section, subject):
            return course_id

    return fallback_id


def init_firebase(credentials_path):
    resolved_credentials = credentials_path or require_firebase_credentials()
    if not os.path.exists(resolved_credentials):
        raise FileNotFoundError(f"Firebase credentials not found: {resolved_credentials}")

    if not firebase_admin._apps:
        cred = credentials.Certificate(resolved_credentials)
        firebase_admin.initialize_app(cred, get_firebase_options())


def collect_school_codes(root, selected_school_code=None):
    if selected_school_code:
        return [selected_school_code]

    schools = root.child("Platform1").child("Schools").get() or {}
    return list(schools.keys())


def build_assignment_updates(school_code, school_root, create_missing_courses=False):
    courses = school_root.child("Courses").get() or {}
    existing_assignments = school_root.child("TeacherAssignments").get() or {}
    grade_management = school_root.child("GradeManagement").child("grades").get() or {}

    desired_assignments = {}
    missing_courses = {}

    for grade_key, grade_data in grade_management.items():
        section_teachers = (grade_data or {}).get("sectionSubjectTeachers") or {}
        for section_key, subject_map in section_teachers.items():
            for subject_key, assignment in (subject_map or {}).items():
                if not isinstance(assignment, dict):
                    continue

                teacher_id = str(assignment.get("teacherId") or assignment.get("teacherRecordKey") or "").strip().lstrip("-")
                if not teacher_id:
                    continue

                resolved_section = assignment.get("section") or section_key
                resolved_subject = assignment.get("subject") or subject_key
                course_id = resolve_course_id(courses, grade_key, resolved_section, resolved_subject)
                assignment_key = f"{teacher_id}__{course_id}"

                desired_assignments[assignment_key] = {
                    "teacherId": teacher_id,
                    "courseId": course_id,
                    "grade": str(grade_key),
                    "section": str(resolved_section).upper(),
                    "subject": humanize_subject(resolved_subject),
                    "source": "GradeManagement.sectionSubjectTeachers",
                }

                if course_id not in courses:
                    missing_courses[course_id] = {
                        "grade": str(grade_key),
                        "section": str(resolved_section).upper(),
                        "subject": humanize_subject(resolved_subject),
                        "name": humanize_subject(resolved_subject),
                    }

    assignment_updates = {}
    for assignment_key, assignment_data in desired_assignments.items():
        current = existing_assignments.get(assignment_key)
        if current != assignment_data:
            assignment_updates[f"Platform1/Schools/{school_code}/TeacherAssignments/{assignment_key}"] = assignment_data

    course_updates = {}
    if create_missing_courses:
        for course_id, course_data in missing_courses.items():
            course_updates[f"Platform1/Schools/{school_code}/Courses/{course_id}"] = course_data

    return assignment_updates, course_updates, desired_assignments, missing_courses


def main():
    parser = argparse.ArgumentParser(description="Sync TeacherAssignments from GradeManagement sectionSubjectTeachers.")
    parser.add_argument("--school-code", help="Only process a single school code.")
    parser.add_argument("--apply", action="store_true", help="Write changes to Firebase. Dry-run by default.")
    parser.add_argument("--create-missing-courses", action="store_true", help="Create missing Courses entries for GradeManagement assignments.")
    parser.add_argument("--credentials", default=os.getenv("FIREBASE_CREDENTIALS") or DEFAULT_CREDENTIALS)
    args = parser.parse_args()

    init_firebase(args.credentials)
    root = db.reference()

    report = []
    combined_updates = {}

    for school_code in collect_school_codes(root, args.school_code):
        school_root = root.child("Platform1").child("Schools").child(school_code)
        assignment_updates, course_updates, desired_assignments, missing_courses = build_assignment_updates(
            school_code,
            school_root,
            create_missing_courses=args.create_missing_courses,
        )

        combined_updates.update(assignment_updates)
        combined_updates.update(course_updates)

        report.append(
            {
                "schoolCode": school_code,
                "assignmentsPrepared": len(desired_assignments),
                "assignmentWrites": len(assignment_updates),
                "missingCourses": sorted(missing_courses.keys()),
                "courseWrites": len(course_updates),
            }
        )

    if args.apply and combined_updates:
        root.update(combined_updates)

    print(json.dumps({
        "apply": args.apply,
        "createMissingCourses": args.create_missing_courses,
        "schools": report,
        "updatesPrepared": len(combined_updates),
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, indent=2))
        sys.exit(1)