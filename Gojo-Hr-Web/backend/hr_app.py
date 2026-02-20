from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Initialize Firebase Admin
cred_path = os.path.join(os.path.dirname(__file__), 'bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json')
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://bale-house-rental-default-rtdb.firebaseio.com'
})

ROOT = 'Employees'

def ref():
    return db.reference(ROOT)

def users_ref():
    return db.reference('Users')

def teachers_ref():
    return db.reference('Teachers')

def employees_ref():
    return db.reference('Employees')


def managements_ref():
    return db.reference('Management')


def finances_ref():
    return db.reference('Finance')


def _generate_employee_code():
    year_suffix = datetime.now().year % 100
    employees_all = employees_ref().get() or {}
    emp_seq = (len(employees_all) or 0) + 1
    return f"EMP_{emp_seq:04d}_{year_suffix}"


def _generate_teacher_code():
    year_suffix = datetime.now().year % 100
    teachers_all = teachers_ref().get() or {}
    teacher_seq = (len(teachers_all) or 0) + 1
    return f"GET_{teacher_seq:04d}_{year_suffix}"


def _generate_management_code():
    year_suffix = datetime.now().year % 100
    managements_all = managements_ref().get() or {}
    mgmt_seq = (len(managements_all) or 0) + 1
    return f"GEM_{mgmt_seq:04d}_{year_suffix}"


def _generate_finance_code():
    year_suffix = datetime.now().year % 100
    finances_all = finances_ref().get() or {}
    fin_seq = (len(finances_all) or 0) + 1
    return f"GEF_{fin_seq:04d}_{year_suffix}"


def _sanitize_employee_payload(emp_payload: dict):
    """Strip unwanted fields from an Employees payload.

    Removes top-level 'courses', 'gender', 'phone', 'phone1', 'phone2'.
    Also removes 'gender' from `personal` and removes phone/gender keys from `contact`.
    Applies same removals inside nested `profileData` if present.
    """
    if not isinstance(emp_payload, dict):
        return emp_payload

    # remove top-level keys
    for k in ('courses', 'gender', 'phone', 'phone1', 'phone2'):
        emp_payload.pop(k, None)

    # sanitize top-level personal
    if isinstance(emp_payload.get('personal'), dict):
        emp_payload['personal'].pop('gender', None)

    # sanitize top-level contact: remove gender but keep phone1/phone2
    if isinstance(emp_payload.get('contact'), dict):
        emp_payload['contact'].pop('gender', None)

    # sanitize profileData if present
    pd = emp_payload.get('profileData')
    if isinstance(pd, dict):
        if isinstance(pd.get('personal'), dict):
            pd['personal'].pop('gender', None)
        if isinstance(pd.get('contact'), dict):
            pd['contact'].pop('gender', None)
        emp_payload['profileData'] = pd

    return emp_payload


@app.route('/employees', methods=['GET'])
def list_employees():
    data = ref().get()
    return jsonify(data or {})


@app.route('/users', methods=['GET'])
def list_users():
    data = users_ref().get()
    return jsonify(data or {})


@app.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    data = users_ref().child(user_id).get()
    if data is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify(data)


@app.route('/employees', methods=['POST'])
def create_employee():
    payload = request.get_json() or {}
    payload = _sanitize_employee_payload(payload)
    node = ref().push(payload)
    return jsonify({'id': node.key}), 201


@app.route('/register-teacher', methods=['POST'])
def register_teacher():
    payload = request.get_json() or {}

    # generate formatted codes
    emp_code = _generate_employee_code()
    teacher_code = _generate_teacher_code()

    # Create user (username will be updated to teacher_code)
    user_payload = {
        'username': payload.get('username') or emp_code,
        'name': payload.get('name'),
        'password': payload.get('password'),
        'role': 'teacher',
        'isActive': payload.get('isActive', True),
        'profileImage': payload.get('profileImage', ''),
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender')
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    # Build employee payload (we create the employee node using the formatted code as key)
    emp_key = f"-{emp_code}"
    employee_payload = {'userId': user_id, 'teacherId': teacher_code}

    contact_section = payload.get('contact') if isinstance(payload.get('contact'), dict) else {}
    if payload.get('email'):
        contact_section.pop('email', None)

    for section in ('personal', 'contact', 'education', 'family', 'job', 'financial'):
        if section == 'contact' and contact_section:
            filtered = {k: v for k, v in contact_section.items() if k not in ('email',)}
            if filtered:
                employee_payload['contact'] = filtered
        elif section in payload:
            sec = payload.get(section)
            if section == 'personal' and isinstance(sec, dict):
                sec = {k: v for k, v in sec.items() if k != 'gender'}
                sec.setdefault('employeeId', emp_code)
            employee_payload[section] = sec

    if 'meta' in payload:
        employee_payload['meta'] = payload.get('meta')

    if isinstance(employee_payload.get('job'), dict):
        employee_payload['job'].setdefault('employeeId', emp_code)

    employee_payload = _sanitize_employee_payload(employee_payload)
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)

    # create teacher record now that employee exists; use code-based key for teacher too
    teacher_key = f"-{teacher_code}"
    teacher_payload = {
        'userId': user_id,
        'employeeId': emp_key,
        'status': payload.get('status', 'active'),
        'profileImage': payload.get('profileImage', ''),
        'teacherId': teacher_code,
    }
    teachers_ref().child(teacher_key).set(teacher_payload)

    # update user to use teacher code as username and record employeeId (use code-based key)
    users_ref().child(user_id).update({'teacherId': teacher_code, 'employeeId': emp_key, 'username': teacher_code})

    return jsonify({'userId': user_id, 'teacherId': teacher_key, 'employeeId': emp_key}), 201


@app.route('/register-management', methods=['POST'])
def register_management():
    payload = request.get_json() or {}

    # generate formatted codes
    emp_code = _generate_employee_code()
    management_code = _generate_management_code()

    # Create user (username will be updated to management_code)
    user_payload = {
        'username': payload.get('username') or emp_code,
        'name': payload.get('name'),
        'password': payload.get('password'),
        'role': 'management',
        'isActive': payload.get('isActive', True),
        'profileImage': payload.get('profileImage', ''),
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender')
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    # Build employee payload (we create the employee node using the formatted code as key)
    emp_key = f"-{emp_code}"
    employee_payload = {'userId': user_id, 'managementId': management_code}

    contact_section = payload.get('contact') if isinstance(payload.get('contact'), dict) else {}
    if payload.get('email'):
        contact_section.pop('email', None)

    for section in ('personal', 'contact', 'education', 'family', 'job', 'financial'):
        if section == 'contact' and contact_section:
            filtered = {k: v for k, v in contact_section.items() if k not in ('email',)}
            if filtered:
                employee_payload['contact'] = filtered
        elif section in payload:
            sec = payload.get(section)
            if section == 'personal' and isinstance(sec, dict):
                sec = {k: v for k, v in sec.items() if k != 'gender'}
                sec.setdefault('employeeId', emp_code)
            employee_payload[section] = sec

    if 'meta' in payload:
        employee_payload['meta'] = payload.get('meta')

    if isinstance(employee_payload.get('job'), dict):
        employee_payload['job'].setdefault('employeeId', emp_code)

    employee_payload = _sanitize_employee_payload(employee_payload)
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)

    # create management record now that employee exists; use code-based key for management too
    management_key = f"-{management_code}"
    management_payload = {
        'userId': user_id,
        'employeeId': emp_key,
        'status': payload.get('status', 'active'),
        'profileImage': payload.get('profileImage', ''),
        'managementId': management_code,
    }
    managements_ref().child(management_key).set(management_payload)

    # update user to use management code as username and record employeeId (use code-based key)
    users_ref().child(user_id).update({'managementId': management_code, 'employeeId': emp_key, 'username': management_code})

    # attach managementId to employee node
    employees_ref().child(emp_key).update({'managementId': management_code})

    return jsonify({'userId': user_id, 'managementId': management_key, 'employeeId': emp_key}), 201


def _file_to_dataurl(fstorage):
    if not fstorage:
        return ""
    data = fstorage.read()
    import base64
    b64 = base64.b64encode(data).decode('utf-8')
    return f"data:{fstorage.mimetype};base64,{b64}"


@app.route('/register/<role>', methods=['POST'])
def register_role(role):
    form = request.form.to_dict()
    files = request.files

    profile_json = {}
    if 'profileData' in form:
        try:
            import json
            profile_json = json.loads(form.get('profileData') or '{}')
        except Exception:
            profile_json = {}

    name = form.get('name') or profile_json.get('personal', {}).get('firstName') or profile_json.get('personal', {}).get('lastName') or 'Unknown'
    password = form.get('password') or 'password123'
    email = form.get('email') or profile_json.get('contact', {}).get('email', '')

    profile_image_data = _file_to_dataurl(files.get('profile')) if 'profile' in files else form.get('profileImage') or ''
    additional_cert_data = _file_to_dataurl(files.get('additionalCert')) if 'additionalCert' in files else ''

    # create user
    user_payload = {
        'username': form.get('username') or (profile_json.get('personal', {}).get('employeeId') or ''),
        'name': name,
        'password': password,
        'role': role,
        'email': email,
        'gender': profile_json.get('personal', {}).get('gender', ''),
        'phone': form.get('phone') or profile_json.get('contact', {}).get('phone', ''),
        'isActive': True,
        'profileImage': profile_image_data or profile_json.get('personal', {}).get('profileImageName', ''),
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    # generate formatted employee code
    emp_code = _generate_employee_code()

    # create employee record first
    employee_payload = {'userId': user_id, 'profileData': profile_json}

    exclude_keys = {'profileData', 'role', 'name', 'password', 'email', 'username', 'profileImage', 'status', 'isActive', 'userId'}
    for k, v in form.items():
        if k not in exclude_keys and k not in employee_payload:
            employee_payload[k] = v

    if isinstance(profile_json, dict):
        for section in ('personal', 'contact', 'education', 'family', 'job', 'financial'):
            if section in profile_json and isinstance(profile_json[section], dict):
                sec = profile_json[section]
                if section == 'personal' and isinstance(sec, dict):
                    sec.setdefault('employeeId', emp_code)
                if section == 'job' and isinstance(sec, dict):
                    sec.setdefault('employeeId', emp_code)
                employee_payload[section] = sec

    employee_payload = _sanitize_employee_payload(employee_payload)
    # persist employee under formatted key
    emp_key = f"-{emp_code}"
    employees_ref().child(emp_key).set(employee_payload)

    # create role node
    teacher_payload = {'userId': user_id, 'employeeId': emp_key, 'status': form.get('status', 'active')}
    if role == 'teacher':
        # generate teacher code and persist under formatted key
        teacher_code = _generate_teacher_code()
        teacher_key = f"-{teacher_code}"
        teacher_payload.update({'teacherId': teacher_code})
        teachers_ref().child(teacher_key).set(teacher_payload)
        # set user's username to teacher code and record teacherId/employeeId (use code-key for employee)
        users_ref().child(user_id).update({'teacherId': teacher_code, 'username': teacher_code, 'employeeId': emp_key})
        employees_ref().child(emp_key).update({'teacherId': teacher_code})
        role_result = teacher_key
    elif role == 'finance':
        # generate finance code and persist under formatted key
        finance_code = _generate_finance_code()
        finance_key = f"-{finance_code}"
        teacher_payload.update({'financeId': finance_code})
        finances_ref().child(finance_key).set(teacher_payload)
        # set user's username to finance code and record financeId/employeeId (use code-key for employee)
        users_ref().child(user_id).update({'financeId': finance_code, 'username': finance_code, 'employeeId': emp_key})
        employees_ref().child(emp_key).update({'financeId': finance_code})
        role_result = finance_key
    elif role == 'management':
        # generate management code and persist under formatted key
        management_code = _generate_management_code()
        management_key = f"-{management_code}"
        teacher_payload.update({'managementId': management_code})
        managements_ref().child(management_key).set(teacher_payload)
        # set user's username to management code and record managementId/employeeId (use code-key for employee)
        users_ref().child(user_id).update({'managementId': management_code, 'username': management_code, 'employeeId': emp_key})
        employees_ref().child(emp_key).update({'managementId': management_code})
        role_result = management_key
    else:
        node = db.reference(role.capitalize()).push(teacher_payload)
        role_node_id = node.key
        users_ref().child(user_id).update({f'{role}Id': role_node_id})
        employees_ref().child(emp_key).update({f'{role}Id': role_node_id})
        role_result = role_node_id

    return jsonify({'success': True, 'message': 'Registered', 'userId': user_id, 'roleId': role_result, 'employeeId': emp_key}), 201


@app.route('/employees/<emp_id>', methods=['GET'])
def get_employee(emp_id):
    data = ref().child(emp_id).get()
    if data is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify(data)


@app.route('/employees/<emp_id>', methods=['PUT'])
def update_employee(emp_id):
    payload = request.get_json() or {}
    payload = _sanitize_employee_payload(payload)
    ref().child(emp_id).update(payload)
    return jsonify({'ok': True})


@app.route('/employees/<emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    ref().child(emp_id).delete()
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
