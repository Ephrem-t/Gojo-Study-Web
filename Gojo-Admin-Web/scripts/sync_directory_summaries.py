from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import sys

import firebase_admin
from firebase_admin import credentials, db


CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
WORKSPACE_ROOT = PROJECT_ROOT.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from firebase_config import get_firebase_options, require_firebase_credentials  # noqa: E402


PLATFORM_ROOT = "Platform1"


def init_firebase():
    if firebase_admin._apps:
        return

    credential_path = require_firebase_credentials()
    cred = credentials.Certificate(credential_path)
    firebase_admin.initialize_app(cred, get_firebase_options())


def platform_ref(path: str = ""):
    clean = str(path or "").strip("/")
    full_path = f"{PLATFORM_ROOT}/{clean}" if clean else PLATFORM_ROOT
    return db.reference(full_path)


def school_node_ref(school_code: str, node_name: str):
    code = str(school_code or "").strip()
    return platform_ref(f"Schools/{code}/{node_name}")


def list_school_codes():
    schools = platform_ref("Schools").get() or {}
    return [str(code).strip() for code in schools.keys() if str(code).strip()]


def safe_text(*values):
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def safe_bool(*values, default=True):
    for value in values:
        if value is None:
            continue
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        if text in {"true", "1", "yes", "active"}:
            return True
        if text in {"false", "0", "no", "inactive"}:
            return False
    return default


def safe_image(*values):
    for value in values:
        text = safe_text(value)
        if not text:
            continue
        lower = text.lower()
        if lower in {"null", "undefined"} or lower.startswith("file://") or lower.startswith("content://"):
            continue
        return text
    return "/default-profile.png"


def safe_age(*values):
    now = datetime.now(timezone.utc)
    for value in values:
        if value is None or isinstance(value, bool):
            continue

        dt_value = None
        if isinstance(value, (int, float)):
            numeric = int(value)
            if 0 < numeric < 150:
                return numeric
            try:
                timestamp = numeric / 1000 if numeric > 10**12 else numeric
                dt_value = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            except Exception:
                dt_value = None
        else:
            text = str(value).strip()
            if not text:
                continue
            if text.isdigit():
                numeric = int(text)
                if 0 < numeric < 150:
                    return numeric
            normalized = text.replace("Z", "+00:00")
            try:
                dt_value = datetime.fromisoformat(normalized)
            except ValueError:
                try:
                    dt_value = datetime.strptime(text[:10], "%Y-%m-%d")
                except ValueError:
                    dt_value = None

        if not dt_value:
            continue
        if dt_value.tzinfo is None:
            dt_value = dt_value.replace(tzinfo=timezone.utc)

        age = now.year - dt_value.year - ((now.month, now.day) < (dt_value.month, dt_value.day))
        if 0 <= age < 150:
            return age

    return None


def iter_child_nodes(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [item for item in value.values() if isinstance(item, dict)]
    return []


def dedupe_items(items):
    seen = set()
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        key = (
            safe_text(item.get("grade")),
            safe_text(item.get("section")),
            safe_text(item.get("subject")),
            safe_text(item.get("courseId")),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "grade": key[0],
            "section": key[1],
            "subject": key[2],
            "courseId": key[3],
        })
    return result


def build_student_directory(school_code: str):
    students = school_node_ref(school_code, "Students").get() or {}
    users = school_node_ref(school_code, "Users").get() or {}
    directory = {}

    for student_id, student_node in (students or {}).items():
        if not isinstance(student_node, dict):
            continue

        basic = student_node.get("basicStudentInformation") or {}
        user_id = safe_text(student_node.get("userId"))
        user_node = users.get(user_id) if user_id else {}
        if not isinstance(user_node, dict):
            user_node = {}

        summary = {
            "studentId": safe_text(student_node.get("studentId"), student_id),
            "userId": user_id,
            "name": safe_text(
                user_node.get("name"),
                student_node.get("name"),
                student_node.get("studentName"),
                basic.get("name"),
                basic.get("studentName"),
                student_id,
            ),
            "profileImage": safe_image(
                user_node.get("profileImage"),
                basic.get("studentPhoto"),
                student_node.get("profileImage"),
                student_node.get("studentPhoto"),
            ),
            "grade": safe_text(student_node.get("grade"), basic.get("grade")),
            "section": safe_text(student_node.get("section"), basic.get("section")),
            "academicYear": safe_text(student_node.get("academicYear"), basic.get("academicYear")),
            "email": safe_text(user_node.get("email"), student_node.get("email")),
            "isActive": safe_bool(user_node.get("isActive"), student_node.get("isActive"), default=True),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        directory[str(student_id)] = summary

    return directory


def build_teacher_directory(school_code: str):
    teachers = school_node_ref(school_code, "Teachers").get() or {}
    users = school_node_ref(school_code, "Users").get() or {}
    assignments = school_node_ref(school_code, "TeacherAssignments").get() or {}
    courses = school_node_ref(school_code, "Courses").get() or {}
    grades_root = school_node_ref(school_code, "GradeManagement/grades").get() or {}
    employees = school_node_ref(school_code, "Employees").get() or {}

    teacher_seed_map = {}
    teacher_links = defaultdict(list)

    for teacher_id, teacher_node in (teachers or {}).items():
        if not isinstance(teacher_node, dict):
            continue
        normalized_teacher_id = safe_text(teacher_node.get("teacherId"), teacher_id)
        teacher_seed_map[normalized_teacher_id] = {
            **teacher_node,
            "teacherId": normalized_teacher_id,
        }

    for employee_id, employee_node in (employees or {}).items():
        if not isinstance(employee_node, dict):
            continue
        teacher_id = safe_text(employee_node.get("teacherId"))
        if not teacher_id:
            continue
        existing = teacher_seed_map.get(teacher_id, {})
        teacher_seed_map[teacher_id] = {
          **existing,
          "teacherId": teacher_id,
          "employeeId": safe_text(existing.get("employeeId"), employee_id),
          "userId": safe_text(existing.get("userId"), employee_node.get("userId")),
          "profileImage": safe_image(existing.get("profileImage"), employee_node.get("profileImage")),
        }

    def add_teacher_link(teacher_id, grade, section, subject, course_id=""):
        normalized_teacher_id = safe_text(teacher_id)
        if not normalized_teacher_id:
            return
        teacher_links[normalized_teacher_id].append({
            "grade": safe_text(grade),
            "section": safe_text(section),
            "subject": safe_text(subject),
            "courseId": safe_text(course_id),
        })

    for assignment in (assignments or {}).values():
        if not isinstance(assignment, dict):
            continue
        teacher_id = safe_text(assignment.get("teacherId"))
        user_id = safe_text(assignment.get("userId"))
        if not teacher_id and user_id:
            teacher_id = next(
                (
                    seed_teacher_id
                    for seed_teacher_id, seed_teacher in teacher_seed_map.items()
                    if safe_text(seed_teacher.get("userId")) == user_id
                ),
                "",
            )
        course_id = safe_text(assignment.get("courseId"))
        course_node = courses.get(course_id) if course_id else {}
        if not isinstance(course_node, dict):
            course_node = {}
        add_teacher_link(
            teacher_id,
            assignment.get("grade") or course_node.get("grade"),
            assignment.get("section") or course_node.get("section"),
            assignment.get("subject") or course_node.get("subject") or course_node.get("courseName") or course_node.get("name"),
            course_id,
        )

    for grade_key, grade_node in (grades_root or {}).items():
        if not isinstance(grade_node, dict):
            continue
        section_subject_teachers = grade_node.get("sectionSubjectTeachers") or {}
        if not isinstance(section_subject_teachers, dict):
            continue
        for section_key, subjects_node in section_subject_teachers.items():
            if not isinstance(subjects_node, dict):
                continue
            for subject_key, assignment_node in subjects_node.items():
                if isinstance(assignment_node, dict):
                    teacher_id = safe_text(assignment_node.get("teacherId"), assignment_node.get("teacher_id"))
                    user_id = safe_text(assignment_node.get("userId"))
                    if not teacher_id and user_id:
                        teacher_id = next(
                            (
                                seed_teacher_id
                                for seed_teacher_id, seed_teacher in teacher_seed_map.items()
                                if safe_text(seed_teacher.get("userId")) == user_id
                            ),
                            "",
                        )
                    subject = assignment_node.get("subject") or subject_key
                    course_id = assignment_node.get("courseId") or assignment_node.get("course_id") or ""
                else:
                    teacher_id = safe_text(assignment_node)
                    subject = subject_key
                    course_id = ""
                add_teacher_link(teacher_id, grade_key, section_key, subject, course_id)

    directory = {}
    for teacher_id, teacher_node in teacher_seed_map.items():
        user_id = safe_text(teacher_node.get("userId"))
        user_node = users.get(user_id) if user_id else {}
        if not isinstance(user_node, dict):
            user_node = {}
        employee_node = next(
            (
                employee
                for employee in (employees or {}).values()
                if isinstance(employee, dict) and safe_text(employee.get("teacherId")) == teacher_id
            ),
            {},
        )
        if not isinstance(employee_node, dict):
            employee_node = {}

        subject_links = dedupe_items(teacher_links.get(teacher_id, []))
        subjects_unique = []
        seen_subjects = set()
        for link in subject_links:
            subject = safe_text(link.get("subject"))
            normalized_subject = subject.lower()
            if not subject or normalized_subject in seen_subjects:
                continue
            seen_subjects.add(normalized_subject)
            subjects_unique.append(subject)

        personal = employee_node.get("personal") if isinstance(employee_node.get("personal"), dict) else {}
        directory[str(teacher_id)] = {
            "teacherId": teacher_id,
            "userId": user_id,
            "name": safe_text(
                user_node.get("name"),
                teacher_node.get("name"),
                employee_node.get("name"),
                employee_node.get("fullName"),
                personal.get("fullName"),
                "Unknown Teacher",
            ),
            "profileImage": safe_image(
                user_node.get("profileImage"),
                teacher_node.get("profileImage"),
                employee_node.get("profileImage"),
                personal.get("profileImage"),
            ),
            "email": safe_text(user_node.get("email"), teacher_node.get("email"), employee_node.get("email")),
            "phone": safe_text(user_node.get("phone"), user_node.get("phoneNumber"), teacher_node.get("phone"), employee_node.get("phone")),
            "gender": safe_text(user_node.get("gender"), teacher_node.get("gender"), employee_node.get("gender"), personal.get("gender")),
            "isActive": safe_bool(user_node.get("isActive"), teacher_node.get("isActive"), employee_node.get("isActive"), default=True),
            "gradesSubjects": subject_links,
            "subjectsUnique": subjects_unique,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

    return directory


def build_parent_directory(school_code: str, student_directory=None):
    parents = school_node_ref(school_code, "Parents").get() or {}
    users = school_node_ref(school_code, "Users").get() or {}
    students = school_node_ref(school_code, "Students").get() or {}
    directory = {}

    if not isinstance(student_directory, dict) or not student_directory:
        student_directory = build_student_directory(school_code)

    students_by_id = {}
    for student_key, student_node in (students or {}).items():
        if not isinstance(student_node, dict):
            continue
        normalized_student_id = safe_text(student_node.get("studentId"), student_key)
        if normalized_student_id:
            students_by_id[normalized_student_id] = student_node

    parent_record_entries_by_user_id = {}
    for parent_key, parent_node in (parents or {}).items():
        if not isinstance(parent_node, dict):
            continue
        user_id = safe_text(parent_node.get("userId"))
        if user_id and user_id not in parent_record_entries_by_user_id:
            parent_record_entries_by_user_id[user_id] = (parent_key, parent_node)

    reverse_child_links = defaultdict(list)

    def register_reverse_child_link(parent_identifier, parent_user_id, student_id, relationship=""):
        normalized_student_id = safe_text(student_id)
        if not normalized_student_id:
            return

        payload = {
            "studentId": normalized_student_id,
            "relationship": safe_text(relationship),
        }
        for value in [parent_identifier, parent_user_id]:
            normalized_parent_value = safe_text(value)
            if normalized_parent_value:
                reverse_child_links[normalized_parent_value].append(payload)

    for student_key, student_node in (students or {}).items():
        if not isinstance(student_node, dict):
            continue

        normalized_student_id = safe_text(student_node.get("studentId"), student_key)
        student_parents = student_node.get("parents") or {}
        if isinstance(student_parents, dict):
            for student_parent_key, student_parent_link in student_parents.items():
                if isinstance(student_parent_link, dict):
                    register_reverse_child_link(
                        student_parent_key,
                        student_parent_link.get("userId"),
                        normalized_student_id,
                        student_parent_link.get("relationship"),
                    )
                    register_reverse_child_link(
                        student_parent_link.get("parentId"),
                        student_parent_link.get("userId"),
                        normalized_student_id,
                        student_parent_link.get("relationship"),
                    )
                else:
                    register_reverse_child_link(student_parent_key, "", normalized_student_id, "")

        parent_guardian_info = student_node.get("parentGuardianInformation") or {}
        guardian_parents = parent_guardian_info.get("parents") if isinstance(parent_guardian_info, dict) else {}
        for guardian_link in iter_child_nodes(guardian_parents):
            system_account_info = guardian_link.get("systemAccountInformation") or {}
            register_reverse_child_link(
                guardian_link.get("parentId"),
                guardian_link.get("userId") or system_account_info.get("userId"),
                normalized_student_id,
                guardian_link.get("relationship"),
            )

    parent_seed_map = {}
    for user_key, user_node in (users or {}).items():
        if not isinstance(user_node, dict):
            continue

        role = safe_text(user_node.get("role")).lower()
        if role != "parent":
            continue

        user_id = safe_text(user_node.get("userId"), user_key)
        if not user_id:
            continue

        parent_key, parent_node = parent_record_entries_by_user_id.get(user_id, ("", {}))
        if not isinstance(parent_node, dict):
            parent_node = {}
        parent_seed_map[user_id] = {
            "directoryKey": user_id,
            "userId": user_id,
            "user": user_node,
            "parentKey": parent_key,
            "parent": parent_node,
        }

    for parent_key, parent_node in (parents or {}).items():
        if not isinstance(parent_node, dict):
            continue

        user_id = safe_text(parent_node.get("userId"))
        directory_key = user_id or safe_text(parent_node.get("parentId"), parent_key)
        if not directory_key:
            continue

        existing = parent_seed_map.get(directory_key, {})
        user_node = existing.get("user") if isinstance(existing.get("user"), dict) else users.get(user_id, {})
        if not isinstance(user_node, dict):
            user_node = {}

        parent_seed_map[directory_key] = {
            "directoryKey": directory_key,
            "userId": user_id or safe_text(existing.get("userId"), directory_key),
            "user": user_node,
            "parentKey": safe_text(existing.get("parentKey"), parent_key),
            "parent": parent_node,
        }

    for directory_key, seed in parent_seed_map.items():
        parent_node = seed.get("parent") if isinstance(seed.get("parent"), dict) else {}
        user_node = seed.get("user") if isinstance(seed.get("user"), dict) else {}
        user_id = safe_text(seed.get("userId"), user_node.get("userId"), directory_key)
        parent_key = safe_text(seed.get("parentKey"), parent_node.get("parentId"), directory_key)

        child_links_by_student_id = {}

        def add_child_link(student_id, relationship=""):
            normalized_student_id = safe_text(student_id)
            if not normalized_student_id:
                return
            existing = child_links_by_student_id.get(normalized_student_id, {})
            child_links_by_student_id[normalized_student_id] = {
                "studentId": normalized_student_id,
                "relationship": safe_text(relationship, existing.get("relationship"), "N/A"),
            }

        for child_link in iter_child_nodes(parent_node.get("children")):
            add_child_link(
                child_link.get("studentId") or child_link.get("student_id") or child_link.get("id"),
                child_link.get("relationship") or child_link.get("relation") or child_link.get("childRelationship"),
            )

        for parent_identifier in {
            safe_text(parent_key),
            safe_text(parent_node.get("parentId")),
            safe_text(user_id),
        }:
            if not parent_identifier:
                continue
            for child_link in reverse_child_links.get(parent_identifier, []):
                add_child_link(child_link.get("studentId"), child_link.get("relationship"))

        child_summaries = []
        for child_link in child_links_by_student_id.values():
            student_id = safe_text(child_link.get("studentId"))
            if not student_id:
                continue

            student_summary = student_directory.get(student_id) if isinstance(student_directory, dict) else {}
            if not isinstance(student_summary, dict):
                student_summary = {}
            student_node = students_by_id.get(student_id, {})
            if not isinstance(student_node, dict):
                student_node = {}
            basic_info = student_node.get("basicStudentInformation") if isinstance(student_node.get("basicStudentInformation"), dict) else {}

            student_user_id = safe_text(
                student_summary.get("userId"),
                student_node.get("userId"),
                student_node.get("use"),
                student_node.get("user"),
            )
            student_user = users.get(student_user_id) if student_user_id else {}
            if not isinstance(student_user, dict):
                student_user = {}

            child_summaries.append({
                "studentId": student_id,
                "userId": student_user_id,
                "name": safe_text(
                    student_summary.get("name"),
                    student_user.get("name"),
                    student_user.get("username"),
                    student_node.get("name"),
                    student_node.get("studentName"),
                    basic_info.get("name"),
                    basic_info.get("studentName"),
                    student_id,
                ),
                "email": safe_text(student_summary.get("email"), student_user.get("email"), student_node.get("email")),
                "grade": safe_text(student_summary.get("grade"), student_node.get("grade"), basic_info.get("grade")),
                "section": safe_text(student_summary.get("section"), student_node.get("section"), basic_info.get("section")),
                "relationship": safe_text(child_link.get("relationship"), "N/A"),
                "profileImage": safe_image(
                    student_summary.get("profileImage"),
                    student_user.get("profileImage"),
                    student_node.get("profileImage"),
                    student_node.get("studentPhoto"),
                    basic_info.get("studentPhoto"),
                ),
            })

        child_summaries.sort(key=lambda item: safe_text(item.get("name"), item.get("studentId")).lower())
        relationships = []
        seen_relationships = set()
        for child_summary in child_summaries:
            relationship = safe_text(child_summary.get("relationship"))
            normalized_relationship = relationship.lower()
            if not relationship or normalized_relationship in seen_relationships:
                continue
            seen_relationships.add(normalized_relationship)
            relationships.append(relationship)

        address = parent_node.get("address")
        if not isinstance(address, (dict, str)):
            fallback_address = user_node.get("address")
            address = fallback_address if isinstance(fallback_address, (dict, str)) else None

        is_active = safe_bool(user_node.get("isActive"), parent_node.get("isActive"), default=True)
        status = safe_text(parent_node.get("status"), "Active" if is_active else "Inactive")
        first_child = child_summaries[0] if child_summaries else {}

        directory[directory_key] = {
            "parentId": safe_text(parent_node.get("parentId"), parent_key),
            "userId": user_id,
            "username": safe_text(user_node.get("username")),
            "name": safe_text(user_node.get("name"), user_node.get("username"), parent_node.get("name"), "No Name"),
            "email": safe_text(user_node.get("email"), parent_node.get("email"), "N/A"),
            "phone": safe_text(user_node.get("phone"), user_node.get("phoneNumber"), parent_node.get("phone"), "N/A"),
            "age": safe_age(
                parent_node.get("age"),
                user_node.get("age"),
                parent_node.get("dob"),
                parent_node.get("birthDate"),
                user_node.get("dob"),
                user_node.get("birthDate"),
            ),
            "city": safe_text(
                parent_node.get("city"),
                address.get("city") if isinstance(address, dict) else "",
                user_node.get("city"),
            ),
            "citizenship": safe_text(parent_node.get("citizenship"), user_node.get("citizenship")),
            "job": safe_text(parent_node.get("job"), user_node.get("job")),
            "address": address,
            "profileImage": safe_image(user_node.get("profileImage"), parent_node.get("profileImage")),
            "isActive": is_active,
            "status": status,
            "additionalInfo": safe_text(parent_node.get("additionalInfo"), "N/A"),
            "createdAt": safe_text(parent_node.get("createdAt"), user_node.get("createdAt")),
            "relationships": relationships,
            "childName": safe_text(first_child.get("name"), "N/A"),
            "childRelationship": safe_text(first_child.get("relationship"), "N/A"),
            "children": child_summaries,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

    return directory


def sync_school(school_code: str):
    student_directory = build_student_directory(school_code)
    teacher_directory = build_teacher_directory(school_code)
    parent_directory = build_parent_directory(school_code, student_directory=student_directory)

    school_node_ref(school_code, "StudentDirectory").set(student_directory)
    school_node_ref(school_code, "TeacherDirectory").set(teacher_directory)
    school_node_ref(school_code, "ParentDirectory").set(parent_directory)

    print(
        f"Synced {school_code}: {len(student_directory)} student summaries, {len(teacher_directory)} teacher summaries, {len(parent_directory)} parent summaries"
    )


def main():
    init_firebase()
    school_codes = list_school_codes()
    if not school_codes:
        print("No schools found under Platform1/Schools.")
        return

    for school_code in school_codes:
        sync_school(school_code)


if __name__ == "__main__":
    main()