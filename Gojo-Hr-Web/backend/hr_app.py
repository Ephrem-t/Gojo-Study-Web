from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import os
from datetime import datetime
from functools import lru_cache
import re

app = Flask(__name__)
CORS(app)

# Initialize Firebase Admin
base_dir = os.path.dirname(__file__)
cred_candidates = [
    os.getenv('FIREBASE_CREDENTIALS', '').strip(),
    os.path.join(base_dir, 'bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad.json'),
    os.path.join(base_dir, 'bale-house-rental-firebase-adminsdk-b9crh-1d29f11aad (2).json'),
]
cred_path = next((p for p in cred_candidates if p and os.path.exists(p)), None)
if not cred_path:
    raise FileNotFoundError(
        'Firebase credential JSON not found. Set FIREBASE_CREDENTIALS or place the file in backend/.'
    )

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://bale-house-rental-default-rtdb.firebaseio.com'
})

ROOT = 'Employees'
PLATFORM_ROOT = (os.getenv('PLATFORM_ROOT') or 'Platform1').strip()
SCHOOLS_ROOT = 'Schools'
DEFAULT_SCHOOL_CODE = (os.getenv('SCHOOL_CODE') or 'ET-ORO-ADA-GMI').strip()

if not DEFAULT_SCHOOL_CODE:
    raise RuntimeError('SCHOOL_CODE cannot be empty.')


@lru_cache(maxsize=1)
def school_root():
    platform_ref = db.reference(PLATFORM_ROOT)
    if platform_ref.get() is None:
        raise RuntimeError(
            f"Missing '{PLATFORM_ROOT}' root in Realtime Database."
        )

    schools_ref = platform_ref.child(SCHOOLS_ROOT)
    if schools_ref.get() is None:
        raise RuntimeError(
            f"Missing '{PLATFORM_ROOT}/{SCHOOLS_ROOT}' root in Realtime Database. Existing node is required."
        )

    school_ref = schools_ref.child(DEFAULT_SCHOOL_CODE)
    if school_ref.get() is None:
        raise RuntimeError(
            f"School node '{PLATFORM_ROOT}/{SCHOOLS_ROOT}/{DEFAULT_SCHOOL_CODE}' does not exist. "
            "Set SCHOOL_CODE to an existing school code."
        )

    return school_ref

def ref():
    return school_root().child(ROOT)

def users_ref():
    return school_root().child('Users')

def teachers_ref():
    return school_root().child('Teachers')

def employees_ref():
    return school_root().child('Employees')


def managements_ref():
    return school_root().child('Management')


def finances_ref():
    return school_root().child('Finance')


def hrs_ref():
    return school_root().child('HR')


def posts_ref():
    return school_root().child('Posts')


def calendar_events_ref():
    return school_root().child('CalendarEvents')


def employees_attendance_ref():
    return school_root().child('Employees_Attendance')


_ISO_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _today_iso_date():
    return datetime.utcnow().date().isoformat()


def _coerce_iso_date(value):
    if not value:
        return None
    value = str(value).strip()
    if not _ISO_DATE_RE.match(value):
        return None
    return value


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


def _generate_hr_code():
    year_suffix = datetime.now().year % 100
    hrs_all = hrs_ref().get() or {}
    hr_seq = (len(hrs_all) or 0) + 1
    return f"GEH_{hr_seq:04d}_{year_suffix}"


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


@app.route('/api/create_post', methods=['POST'])
def create_post():
    try:
        body = request.get_json(silent=True) or {}
        form = request.form.to_dict() if request.form else {}

        def pick(key, default=''):
            if form.get(key) is not None:
                return form.get(key)
            if body.get(key) is not None:
                return body.get(key)
            return default

        message = (pick('message', '') or '').strip()
        post_url = pick('postUrl', '') or ''
        hr_id = pick('hrId', '') or ''
        admin_name = pick('adminName', '') or ''
        admin_profile = pick('adminProfile', '') or ''
        user_id = pick('userId', '') or ''
        target_role = (pick('targetRole', 'all') or 'all').strip().lower()

        post_obj = {
            'hrId':  hr_id,
            'userId': user_id,
            'adminName': admin_name or 'HR Office',
            'adminProfile': admin_profile,
            'postUrl': post_url,
            'message': message,
            'targetRole': target_role or 'all',
            'likeCount': 0,
            'likes': {},
            'seenBy': {},
            'time': datetime.utcnow().isoformat()
        }

        owner_key = post_obj.get('hrId') or post_obj.get('userId')
        if owner_key:
            post_obj['seenBy'][owner_key] = True

        new_ref = posts_ref().push(post_obj)
        post_id = new_ref.key
        posts_ref().child(post_id).update({'postId': post_id, 'schoolCode': DEFAULT_SCHOOL_CODE})

        created = posts_ref().child(post_id).get() or {}
        created['postId'] = post_id
        created['schoolCode'] = DEFAULT_SCHOOL_CODE

        return jsonify({'success': True, 'post': created}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/get_posts', methods=['GET'])
def get_posts():
    try:
        posts = posts_ref().get() or {}
        result = []

        if isinstance(posts, dict):
            for key, value in posts.items():
                item = value or {}
                item['postId'] = item.get('postId') or key
                item['schoolCode'] = item.get('schoolCode') or DEFAULT_SCHOOL_CODE
                result.append(item)

        try:
            result.sort(key=lambda x: x.get('time') or x.get('createdAt') or '', reverse=True)
        except Exception:
            pass

        return jsonify(result), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/delete_post/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        target_ref = posts_ref().child(post_id)
        if target_ref.get() is None:
            return jsonify({'success': False, 'message': 'Post not found'}), 404

        target_ref.delete()
        return jsonify({'success': True, 'postId': post_id}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/like_post', methods=['POST'])
def like_post():
    try:
        body = request.get_json(silent=True) or {}
        form = request.form.to_dict() if request.form else {}

        post_id = (
            body.get('postId')
            or form.get('postId')
            or request.args.get('postId')
            or ''
        ).strip()

        actor_id = str(
            body.get('userId')
            or body.get('hrId')
            or form.get('userId')
            or form.get('hrId')
            or request.args.get('userId')
            or request.args.get('hrId')
            or ''
        ).strip()

        if not post_id:
            return jsonify({'success': False, 'message': 'postId is required'}), 400
        if not actor_id:
            return jsonify({'success': False, 'message': 'user identifier is required'}), 400

        post_ref = posts_ref().child(post_id)
        post_data = post_ref.get()
        if not post_data:
            return jsonify({'success': False, 'message': 'Post not found'}), 404

        likes = post_data.get('likes') if isinstance(post_data.get('likes'), dict) else {}
        liked = False

        if likes.get(actor_id):
            likes.pop(actor_id, None)
        else:
            likes[actor_id] = True
            liked = True

        like_count = len([value for value in likes.values() if value])
        post_ref.update({'likes': likes, 'likeCount': like_count})

        return jsonify({
            'success': True,
            'liked': liked,
            'likeCount': like_count,
            'likes': likes,
            'postId': post_id,
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/calendar_events', methods=['GET'])
def get_calendar_events():
    try:
        raw_events = calendar_events_ref().get() or {}
        events = []

        if isinstance(raw_events, dict):
            for event_id, value in raw_events.items():
                event_item = value or {}
                event_item['id'] = event_item.get('id') or event_id
                events.append(event_item)

        show_deadlines_only = request.args.get('deadlinesOnly', '0').strip().lower() in ('1', 'true', 'yes')
        upcoming_only = request.args.get('upcoming', '0').strip().lower() in ('1', 'true', 'yes')
        days_param = request.args.get('days', '').strip()

        horizon_days = None
        if days_param:
            try:
                horizon_days = max(0, int(days_param))
            except Exception:
                horizon_days = None

        today = datetime.utcnow().date()

        normalized = []
        for event_item in events:
            iso_date = (event_item.get('gregorianDate') or '').strip()
            parsed_date = None
            if iso_date:
                try:
                    parsed_date = datetime.strptime(iso_date, '%Y-%m-%d').date()
                except Exception:
                    parsed_date = None

            normalized.append({
                **event_item,
                'gregorianDate': iso_date,
                '_parsedDate': parsed_date,
                'showInUpcomingDeadlines': bool(event_item.get('showInUpcomingDeadlines')),
            })

        if show_deadlines_only:
            normalized = [event_item for event_item in normalized if event_item.get('showInUpcomingDeadlines')]

        if upcoming_only:
            upcoming_filtered = []
            for event_item in normalized:
                parsed_date = event_item.get('_parsedDate')
                if not parsed_date:
                    continue
                if parsed_date < today:
                    continue
                if horizon_days is not None and (parsed_date - today).days > horizon_days:
                    continue
                upcoming_filtered.append(event_item)
            normalized = upcoming_filtered

        normalized.sort(key=lambda event_item: (
            event_item.get('_parsedDate') is None,
            event_item.get('_parsedDate') or datetime.max.date(),
            event_item.get('createdAt') or '',
        ))

        for event_item in normalized:
            event_item.pop('_parsedDate', None)

        return jsonify({'success': True, 'events': normalized}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


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
    elif role == 'hr':
        hr_code = _generate_hr_code()
        hr_key = f"-{hr_code}"
        teacher_payload.update({'hrId': hr_code})
        hrs_ref().child(hr_key).set(teacher_payload)
        users_ref().child(user_id).update({'hrId': hr_code, 'username': hr_code, 'employeeId': emp_key})
        employees_ref().child(emp_key).update({'hrId': hr_code})
        role_result = hr_key
    else:
        node = school_root().child(role.capitalize()).push(teacher_payload)
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


@app.route('/login', methods=['POST'])
def login():
    payload = request.get_json() or {}
    username = (payload.get('username') or '').strip()
    password = payload.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400

    users = users_ref().get() or {}
    # users is a mapping of uid -> user object
    for uid, user in (users.items() if isinstance(users, dict) else []):
        if not isinstance(user, dict):
            continue
        if (user.get('username') or '').strip() == username and (user.get('password') or '') == password:
            # successful login - return minimal user info
            safe = {
                'id': uid,
                'username': user.get('username'),
                'name': user.get('name'),
                'role': user.get('role'),
                'isActive': user.get('isActive', True),
                'email': user.get('email', ''),
                'profileImage': user.get('profileImage', '')
            }
            return jsonify({'ok': True, 'user': safe})

    return jsonify({'ok': False, 'error': 'invalid credentials'}), 401


@app.route('/api/employee_attendance', methods=['GET'])
def get_employee_attendance():
    iso_date = _coerce_iso_date(request.args.get('date')) or _today_iso_date()
    data = employees_attendance_ref().child(iso_date).get() or {}
    return jsonify({'ok': True, 'date': iso_date, 'attendance': data}), 200


@app.route('/api/employee_attendance', methods=['POST'])
def upsert_employee_attendance():
    payload = request.get_json() or {}
    iso_date = _coerce_iso_date(payload.get('date')) or _today_iso_date()
    marked_by = payload.get('markedBy') or payload.get('marked_by')

    attendance_map = payload.get('attendance')
    records_list = payload.get('records')

    normalized = {}

    if isinstance(attendance_map, dict):
        for emp_id, entry in attendance_map.items():
            if not emp_id:
                continue
            if isinstance(entry, dict):
                present = entry.get('present')
                status = entry.get('status')
                note = entry.get('note')
            else:
                present = bool(entry)
                status = None
                note = None

            if present is None:
                normalized_status = str(status or '').lower()
                present = True if normalized_status in ('present', 'late') else False

            normalized[str(emp_id)] = {
                'present': bool(present),
                'status': (status or ('present' if present else 'absent')),
                'note': note or '',
                'updatedAt': datetime.utcnow().isoformat() + 'Z',
                'markedBy': marked_by or '',
            }

    elif isinstance(records_list, list):
        for entry in records_list:
            if not isinstance(entry, dict):
                continue
            emp_id = entry.get('employeeId') or entry.get('empId') or entry.get('id')
            if not emp_id:
                continue
            present = entry.get('present')
            status = entry.get('status')
            note = entry.get('note')
            if present is None:
                normalized_status = str(status or '').lower()
                present = True if normalized_status in ('present', 'late') else False

            normalized[str(emp_id)] = {
                'present': bool(present),
                'status': (status or ('present' if present else 'absent')),
                'note': note or '',
                'updatedAt': datetime.utcnow().isoformat() + 'Z',
                'markedBy': marked_by or '',
            }

    else:
        return jsonify({'ok': False, 'error': 'attendance (object) or records (array) is required'}), 400

    employees_attendance_ref().child(iso_date).update(normalized)
    return jsonify({'ok': True, 'date': iso_date, 'savedCount': len(normalized)}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
