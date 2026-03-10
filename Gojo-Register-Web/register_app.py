from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
import sys
import json
from datetime import datetime


app = Flask(__name__)
CORS(app)

# Path to your Firebase service account JSON (located next to this script)
firebase_json = os.path.join(os.path.dirname(__file__), "bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json")
if not os.path.exists(firebase_json):
    print(f"Firebase JSON missing at {firebase_json}")
    sys.exit(1)

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://bale-house-rental-default-rtdb.firebaseio.com/",
    "storageBucket": "bale-house-rental.appspot.com"
})
bucket = storage.bucket()

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


def generate_scoped_id(school_code, node_name, prefix):
    node = school_ref(school_code).child(node_name).get() or {}
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

        def normalize_text(value):
            return str(value or "").strip().lower().replace("_", " ").replace("-", " ")

        role = normalize_text(matched_user.get("role"))
        username_value = str(matched_user.get("username") or "").strip().upper()

        if role != "registerer" or not username_value.startswith("GSR_"):
            return jsonify({
                "success": False,
                "message": "Only registerer accounts (GSR_...) can login to this portal"
            }), 403

        registerers = ((all_schools.get(matched_school_code) or {}).get("Registerers") or {})
        matched_registerer = None
        for rid, reg in registerers.items():
            row = reg or {}
            if rid == username_value or row.get("userId") == matched_user.get("userId"):
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
        targetRole = normalize_target_role(request.form.get("targetRole") or request.form.get("target") or "all")
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
            "targetRole": targetRole,
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


@app.route("/academic-years/rollover", methods=["POST"])
@app.route("/api/academic-years/rollover", methods=["POST"])
def rollover_academic_year():
    try:
        school_code = get_school_code_from_request()
        body = request.get_json(silent=True) or {}
        if not school_code:
            return jsonify({"success": False, "message": "schoolCode is required"}), 400

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

        now_iso = datetime.utcnow().isoformat()

        students_ref = school_ref(school_code).child("Students")
        parents_ref = school_ref(school_code).child("Parents")
        students = students_ref.get() or {}
        parents = parents_ref.get() or {}
        history_root_ref = school_ref(school_code).child(f"YearHistory/{normalized_current_year}")
        history_students_ref = history_root_ref.child("Students")
        history_parents_ref = history_root_ref.child("Parents")

        snapshot_excluded_nodes = {"YearHistory", "Students", "Parents"}
        school_snapshot = {}
        school_snapshot_counts = {}

        for node_name, node_value in (school_node or {}).items():
            if node_name in snapshot_excluded_nodes:
                continue

            school_snapshot[node_name] = node_value
            school_snapshot_counts[node_name] = len(node_value) if isinstance(node_value, dict) else (1 if node_value else 0)

        if school_snapshot:
            history_root_ref.child("SchoolSnapshot").set({
                "archivedAt": now_iso,
                "fromAcademicYear": normalized_current_year,
                "toAcademicYear": target_year,
                "excludedNodes": sorted(snapshot_excluded_nodes),
                "data": school_snapshot,
            })

        promoted = 0
        graduated = 0
        skipped = 0
        moved_students = 0
        moved_parents = 0

        def collect_parent_ids(student_node):
            out = set()
            node = student_node or {}

            by_map = node.get("parents") or {}
            if isinstance(by_map, dict):
                for pid in by_map.keys():
                    pid_text = str(pid or "").strip()
                    if pid_text:
                        out.add(pid_text)

            parent_section = ((node.get("parentGuardianInformation") or {}).get("parents") or [])
            if isinstance(parent_section, list):
                for parent_row in parent_section:
                    pid_text = str((parent_row or {}).get("parentId") or "").strip()
                    if pid_text:
                        out.add(pid_text)

            return out

        def has_parent_in_non_rolled_students(parent_id, rolled_student_ids):
            parent_text = str(parent_id or "").strip()
            if not parent_text:
                return False

            for sid, s_node in (students or {}).items():
                if sid in rolled_student_ids:
                    continue
                if parent_text in collect_parent_ids(s_node):
                    return True
            return False

        rolled_student_ids = set()
        linked_parent_ids = set()

        for student_id, node in (students or {}).items():
            student = node or {}
            student_year = normalize_year_key(student.get("academicYear"))

            if student_year != normalized_current_year:
                continue

            status = str(student.get("status") or "active").strip().lower()
            grade_raw = student.get("grade")
            promoted_grade = None
            outcome = "archived_only"

            if status in ("active", "enrolled"):
                try:
                    current_grade = int(str(grade_raw).strip())
                    if current_grade >= max_grade:
                        graduated += 1
                        outcome = "graduated"
                    else:
                        promoted_grade = str(current_grade + 1)
                        promoted += 1
                        outcome = "promoted"
                except Exception:
                    skipped += 1
                    outcome = "skipped"
            else:
                skipped += 1

            student_history_payload = {
                **student,
                "rollover": {
                    "rolledOverAt": now_iso,
                    "fromAcademicYear": normalized_current_year,
                    "toAcademicYear": target_year,
                    "outcome": outcome,
                    "promotedToGrade": promoted_grade,
                },
            }
            history_students_ref.child(student_id).set(student_history_payload)
            moved_students += 1
            rolled_student_ids.add(student_id)
            linked_parent_ids.update(collect_parent_ids(student))

        for parent_id in linked_parent_ids:
            parent_node = (parents or {}).get(parent_id) or {}
            if parent_node:
                history_parents_ref.child(parent_id).set({
                    **parent_node,
                    "rollover": {
                        "rolledOverAt": now_iso,
                        "fromAcademicYear": normalized_current_year,
                        "toAcademicYear": target_year,
                    },
                })

            if not has_parent_in_non_rolled_students(parent_id, rolled_student_ids):
                parents_ref.child(parent_id).delete()
                moved_parents += 1

        for student_id in rolled_student_ids:
            students_ref.child(student_id).delete()

        reset_summary = {
            "resetYearlyData": bool(reset_yearly_data),
            "archivedNodes": {},
            "clearedNodes": [],
            "schoolSnapshotNodes": sorted(school_snapshot.keys()),
            "schoolSnapshotCounts": school_snapshot_counts,
        }

        if reset_yearly_data:
            yearly_nodes = ["ClassMarks", "Attendance", "monthlyPaid"]
            operational_history_ref = history_root_ref.child("OperationalData")

            for node_name in yearly_nodes:
                node_ref = school_ref(school_code).child(node_name)
                node_data = node_ref.get() or {}
                archive_count = len(node_data) if isinstance(node_data, dict) else (1 if node_data else 0)
                reset_summary["archivedNodes"][node_name] = archive_count

                if node_data:
                    operational_history_ref.child(node_name).set({
                        "archivedAt": now_iso,
                        "fromAcademicYear": normalized_current_year,
                        "data": node_data,
                    })

                node_ref.set({})
                reset_summary["clearedNodes"].append(node_name)

            history_root_ref.child("rolloverMeta").update({
                "rolledOverAt": now_iso,
                "fromAcademicYear": normalized_current_year,
                "toAcademicYear": target_year,
                "promoted": promoted,
                "graduated": graduated,
                "skipped": skipped,
                "movedStudents": moved_students,
                "movedParents": moved_parents,
                "schoolSnapshotStored": bool(school_snapshot),
                "schoolSnapshotNodes": sorted(school_snapshot.keys()),
                "resetYearlyData": True,
            })
        else:
            history_root_ref.child("rolloverMeta").update({
                "rolledOverAt": now_iso,
                "fromAcademicYear": normalized_current_year,
                "toAcademicYear": target_year,
                "promoted": promoted,
                "graduated": graduated,
                "skipped": skipped,
                "movedStudents": moved_students,
                "movedParents": moved_parents,
                "schoolSnapshotStored": bool(school_snapshot),
                "schoolSnapshotNodes": sorted(school_snapshot.keys()),
                "resetYearlyData": False,
            })

        years_snapshot = years_ref.get() or {}
        for key, value in years_snapshot.items():
            row = value or {}
            current_status = str(row.get("status") or "inactive").strip().lower()
            if key == target_year:
                years_ref.child(key).update({"isCurrent": True, "status": "active", "activatedAt": now_iso})
            elif key == normalized_current_year:
                years_ref.child(key).update({"isCurrent": False, "status": "archived", "archivedAt": now_iso})
            else:
                keep_status = "archived" if current_status == "archived" else "inactive"
                years_ref.child(key).update({"isCurrent": False, "status": keep_status})

        school_ref(school_code).child("schoolInfo").update({"currentAcademicYear": target_year})

        return jsonify({
            "success": True,
            "message": f"Rollover completed to {year_label_from_key(target_year)}.",
            "fromYear": normalized_current_year,
            "toYear": target_year,
            "promoted": promoted,
            "graduated": graduated,
            "skipped": skipped,
            "movedStudents": moved_students,
            "movedParents": moved_parents,
            "resetSummary": reset_summary,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True, use_reloader=False)
