from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db

import os
from datetime import datetime
from functools import lru_cache
import re
import tempfile
from werkzeug.utils import secure_filename
from firebase_admin import storage
import base64


app = Flask(__name__)
CORS(app)

# Configure storage bucket name from env
FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET', 'bale-house-rental.appspot.com')

# Initialize Firebase Storage bucket accessor
def get_storage_bucket():
    try:
        return storage.bucket(FIREBASE_STORAGE_BUCKET)
    except Exception:
        # last-resort: try default bucket
        return storage.bucket()

# Upload file to Firebase Storage and return download URL
def upload_profile_image_to_storage(file_storage, user_id):
    if not file_storage:
        return ''
    bucket = get_storage_bucket()
    if bucket is None:
        raise RuntimeError('Storage bucket not available. Ensure FIREBASE_STORAGE_BUCKET and credentials are configured.')
    # Build a stable filename using user's role/username/employeeId when available
    filename = secure_filename(file_storage.filename or '')
    ext = os.path.splitext(filename)[1] if filename else ''
    # try to derive a meaningful base name from Users node
    try:
        user_data = users_ref().child(user_id).get() or {}
    except Exception:
        user_data = {}

    base_name = None
    # prefer role id fields or username/employeeId
    for key in ('hrId', 'teacherId', 'managementId', 'financeId', 'username', 'employeeId'):
        v = user_data.get(key) if isinstance(user_data, dict) else None
        if v:
            base_name = str(v)
            break

    if not base_name:
        # fallback to user_id
        base_name = str(user_id)

    # timestamp for uniqueness
    ts = str(int(datetime.utcnow().timestamp()))
    # ensure extension default
    if not ext:
        # try to infer from mimetype
        mimetype = getattr(file_storage, 'mimetype', '') or 'image/jpeg'
        if '/' in mimetype:
            guessed_ext = mimetype.split('/')[-1]
            ext = f'.{guessed_ext}'
        else:
            ext = '.jpg'

    storage_filename = f"{base_name}_{ts}_profile{ext}"
    storage_path = f'HR/{storage_filename}'
    blob = bucket.blob(storage_path)
    # Save file to a temp file for upload. On Windows NamedTemporaryFile keeps the
    # file open which can cause PermissionError when another handle tries to open
    # it; so create with delete=False, close it, then upload and finally remove.
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp_path = tmp.name
    try:
        tmp.close()
        try:
            file_storage.save(tmp_path)
        except Exception as ex:
            raise RuntimeError(f'Failed saving incoming file to temp path: {ex}')
        try:
            blob.upload_from_filename(tmp_path, content_type=file_storage.mimetype)
        except Exception as ex:
            raise RuntimeError(f'Failed uploading file to storage: {ex}')
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
    # Make public and get URL
    try:
        blob.make_public()
    except Exception as ex:
        raise RuntimeError(f'Uploaded but failed to make object public: {ex}')
    return blob.public_url

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
    'databaseURL': 'https://bale-house-rental-default-rtdb.firebaseio.com',
    'storageBucket': FIREBASE_STORAGE_BUCKET,
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


def _remove_role_nodes_for_employee(emp_id, employee_data=None, user_data=None):
    employee_data = employee_data or {}
    user_data = user_data or {}

    role_specs = [
        ('teacherId', teachers_ref),
        ('managementId', managements_ref),
        ('financeId', finances_ref),
        ('hrId', hrs_ref),
    ]

    removed_nodes = []

    for role_key, ref_factory in role_specs:
        role_ref = ref_factory()
        role_nodes = role_ref.get() or {}
        if not isinstance(role_nodes, dict):
            continue

        target_role_code = (
            employee_data.get(role_key)
            or (employee_data.get('profileData') or {}).get(role_key)
            or user_data.get(role_key)
        )

        for node_key, node_value in role_nodes.items():
            node_payload = node_value or {}
            if not isinstance(node_payload, dict):
                continue

            node_employee_id = str(node_payload.get('employeeId') or '')
            node_role_code = str(node_payload.get(role_key) or '')
            should_remove = node_employee_id == str(emp_id)

            if not should_remove and target_role_code:
                should_remove = node_role_code == str(target_role_code)

            if should_remove:
                role_ref.child(node_key).delete()
                removed_nodes.append({'role': role_key, 'nodeKey': node_key})

    return removed_nodes


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


def generate_employee_code():
    year_suffix = datetime.now().year % 100
    employees_all = employees_ref().get() or {}
    emp_seq = (len(employees_all) or 0) + 1
    return f"EMP_{emp_seq:04d}_{year_suffix}"


def get_school_shortname():
    """Return the school's shortname stored under schoolinfo.shortname (uppercased).

    Falls back to DEFAULT_SCHOOL_CODE if not present.
    """
    try:
        # try both common spellings for the node (some databases use `schoolInfo`)
        info = school_root().child('schoolinfo').get()
        if info is None:
            info = school_root().child('schoolInfo').get() or {}
        if isinstance(info, dict):
            for key in ('shortname', 'shortName', 'short', 'short_name'):
                val = info.get(key)
                if val:
                    return str(val).strip().upper()
        if isinstance(info, str) and info.strip():
            return info.strip().upper()
    except Exception:
        pass
    # fallback: remove non-alphanum and uppercase
    return re.sub(r'[^A-Za-z0-9]', '', DEFAULT_SCHOOL_CODE).upper()


def generate_teacher_code():
    year_suffix = datetime.now().year % 100
    teachers_all = teachers_ref().get() or {}
    teacher_seq = (len(teachers_all) or 0) + 1
    short = get_school_shortname()
    return f"{short}T_{teacher_seq:04d}_{year_suffix:02d}"


def generate_management_code():
    year_suffix = datetime.now().year % 100
    managements_all = managements_ref().get() or {}
    mgmt_seq = (len(managements_all) or 0) + 1
    short = get_school_shortname()
    return f"{short}A_{mgmt_seq:04d}_{year_suffix:02d}"


def generate_finance_code():
    year_suffix = datetime.now().year % 100
    finances_all = finances_ref().get() or {}
    fin_seq = (len(finances_all) or 0) + 1
    short = get_school_shortname()
    return f"{short}F_{fin_seq:04d}_{year_suffix:02d}"


def generate_hr_code():
    year_suffix = datetime.now().year % 100
    hrs_all = hrs_ref().get() or {}
    hr_seq = (len(hrs_all) or 0) + 1
    short = get_school_shortname()
    return f"{short}H_{hr_seq:04d}_{year_suffix:02d}"


def sanitize_employee_payload(emp_payload: dict):
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


def _normalize_gender(raw):
    if raw is None:
        return None
    try:
        g = str(raw).strip().lower()
    except Exception:
        return None
    if not g:
        return None
    if 'f' in g:
        return 'female'
    if 'm' in g:
        return 'male'
    return None


@app.route('/employees_with_gender', methods=['GET'])
def list_employees_with_gender():
    """Return employees with a computed `gender` field.

    Gender is resolved from, in order:
      - Employees node top-level 'gender'
      - Employees.personal.gender
      - Employees.profileData.personal.gender
      - Linked Users node 'gender' (if employee.userId present)
    The returned payload mirrors the Employees node but guarantees a `gender` key
    with value 'male'|'female' or null when unknown.
    """
    try:
        raw = ref().get() or {}
        users_map = users_ref().get() or {}
        result = {}
        if isinstance(raw, dict):
            for emp_id, payload in raw.items():
                payload = payload or {}
                gender = None
                # top-level
                gender = _normalize_gender(payload.get('gender'))
                # personal
                if not gender and isinstance(payload.get('personal'), dict):
                    gender = _normalize_gender(payload.get('personal', {}).get('gender'))
                # profileData.personal
                if not gender and isinstance(payload.get('profileData'), dict):
                    gender = _normalize_gender((payload.get('profileData') or {}).get('personal', {}).get('gender'))

                # try linked user
                if not gender:
                    user_id = payload.get('userId')
                    if user_id and isinstance(users_map, dict):
                        user_payload = users_map.get(str(user_id)) or users_map.get(user_id) or {}
                        gender = _normalize_gender(user_payload.get('gender') or (user_payload.get('personal') or {}).get('gender'))

                # ensure we don't mutate original
                item = dict(payload)
                item['gender'] = gender
                result[emp_id] = item

        return jsonify(result), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/users', methods=['GET'])
def list_users():
    data = users_ref().get()
    return jsonify(data or {})


@app.route('/school_context', methods=['GET'])
def get_school_context():
    return jsonify({
        'schoolCode': DEFAULT_SCHOOL_CODE,
        'schoolShortname': get_school_shortname(),
        'platformRoot': PLATFORM_ROOT,
        'schoolsRoot': SCHOOLS_ROOT,
    }), 200


@app.route('/teachers', methods=['GET'])
def list_teachers():
    data = teachers_ref().get()
    return jsonify(data or {})


@app.route('/management', methods=['GET'])
def list_management():
    data = managements_ref().get()
    return jsonify(data or {})


@app.route('/finance', methods=['GET'])
def list_finance():
    data = finances_ref().get()
    return jsonify(data or {})


@app.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    data = users_ref().child(user_id).get()
    if data is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify(data)


@app.route('/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user fields. Accepts JSON payload with fields to update."""
    try:
        payload = request.get_json() or {}
        # sanitize minimal fields
        allowed = {}
        for k, v in (payload.items() if isinstance(payload, dict) else []):
            # allow common profile fields (include password)
            if k in ('name', 'username', 'profileImage', 'email', 'phone', 'role', 'isActive', 'password'):
                allowed[k] = v
        if allowed:
            users_ref().child(user_id).update(allowed)
        return jsonify({'ok': True}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/users/<user_id>/upload_profile_image', methods=['POST'])
def upload_user_profile_image(user_id):
    # Accepts file field 'profile' similar to employees upload
    try:
        if 'profile' in request.files:
            file = request.files['profile']
            if file.filename == '':
                return jsonify({'error': 'No selected file.'}), 400
            try:
                url = upload_profile_image_to_storage(file, user_id)
                # update users node
                users_ref().child(user_id).update({'profileImage': url})
                return jsonify({'profileImageUrl': url}), 200
            except Exception as ue:
                # Do NOT fallback to data URLs silently. Return a clear error so the client
                # can surface the problem and the environment can be fixed.
                import traceback
                tb = traceback.format_exc()
                app.logger.error('upload_user_profile_image upload error: %s', tb)
                # Provide actionable guidance for common misconfiguration
                hint = (
                    'Storage upload failed. Ensure FIREBASE_CREDENTIALS points to a valid service account JSON, '
                    'FIREBASE_STORAGE_BUCKET is set to your GCS bucket name, and the service account has '
                    'storage.objects.create and storage.objects.get permissions (and objects.list if needed).'
                )
                return jsonify({'error': str(ue), 'hint': hint, 'trace': tb}), 500

        # If client sent a profileImage URL in form data
        form = request.form or {}
        if form.get('profileImage'):
            url = form.get('profileImage')
            users_ref().child(user_id).update({'profileImage': url})
            return jsonify({'profileImageUrl': url}), 200

        return jsonify({'error': 'No file or profileImage provided.'}), 400
    except Exception as e:
        # include a short trace in debug
        import traceback
        tb = traceback.format_exc()
        app.logger.error('upload_user_profile_image error: %s', tb)
        return jsonify({'error': str(e), 'trace': tb}), 500


@app.route('/employees', methods=['POST'])
def create_employee():
    payload = request.get_json() or {}
    payload = sanitize_employee_payload(payload)
    node = ref().push(payload)
    return jsonify({'id': node.key}), 201


@app.route('/register-teacher', methods=['POST'])
def register_teacher():
    payload = request.get_json() or {}

    # generate formatted codes
    emp_code = generate_employee_code()
    teacher_code =  generate_teacher_code()

    # Create user (username will be updated to teacher_code)
    user_payload = {
        'username': teacher_code,  # username is always the role id
        'name': payload.get('name'),
        'password': payload.get('password'),
        'role': 'teacher',
        'isActive': payload.get('isActive', True),
        'profileImage': payload.get('profileImage', ''),
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender'),
        'teacherId': teacher_code  # ensure role id is present
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    # Build employee payload (we create the employee node using the formatted code as key)
    emp_key = emp_code  # Employees node key is employee id
    employee_payload = {'userId': user_id, 'teacherId': teacher_code}  # Only teacherId as top-level field

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

    employee_payload = sanitize_employee_payload(employee_payload)
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)

    # create teacher record now that employee exists; use role id as key for teacher
    teacher_payload = {
        'userId': user_id,
        'employeeId': emp_key,  # employeeId is EMP_xxx
        'status': payload.get('status', 'active'),
        'profileImage': payload.get('profileImage', ''),
    }
    teachers_ref().child(teacher_code).set(teacher_payload)

    # update user to use teacher code as username and record employeeId (use code-based key)
    users_ref().child(user_id).update({
        'teacherId': teacher_code,
        'employeeId': emp_key,
        'username': teacher_code,
        # store the school's short name instead of the internal school code
        'schoolCode': get_school_shortname()
    })

    return jsonify({'userId': user_id, 'teacherId': teacher_code, 'employeeId': emp_key}), 201


@app.route('/register-management', methods=['POST'])
def register_management():
    payload = request.get_json() or {}

    # generate formatted codes
    emp_code = generate_employee_code()
    management_code = generate_management_code()

    # Create user (username will be updated to management_code)
    user_payload = {
        'username': management_code,  # username is always the role id
        'name': payload.get('name'),
        'password': payload.get('password'),
        'role': 'management',
        'isActive': payload.get('isActive', True),
        'profileImage': payload.get('profileImage', ''),
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender'),
        'managementId': management_code  # ensure role id is present
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    # Build employee payload (we create the employee node using the formatted code as key)
    emp_key = emp_code  # Employees node key is employee id
    employee_payload = {'userId': user_id, 'managementId': management_code}  # Only managementId as top-level field

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

    employee_payload = sanitize_employee_payload(employee_payload)
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)

    # create management record now that employee exists; use role id as key for management
    management_payload = {
        'userId': user_id,
        'employeeId': emp_key,  # employeeId is EMP_xxx
        'status': payload.get('status', 'active'),
        'profileImage': payload.get('profileImage', ''),
    }
    managements_ref().child(management_code).set(management_payload)

    # update user to use management code as username and record employeeId (use code-based key)
    users_ref().child(user_id).update({
        'managementId': management_code,
        'employeeId': emp_key,
        'username': management_code,
        # store the school's short name instead of the internal school code
        'schoolCode': get_school_shortname()
    })

    # attach managementId to employee node
    employees_ref().child(emp_key).update({'managementId': management_code})

    return jsonify({'userId': user_id, 'managementId': management_code, 'employeeId': emp_key}), 201



# Deprecated: Use upload_profile_image_to_storage instead for profile images
def _file_to_dataurl(fstorage):
    if not fstorage:
        return ""
    data = fstorage.read()
    import base64
    b64 = base64.b64encode(data).decode('utf-8')
    return f"data:{fstorage.mimetype};base64,{b64}"


def _normalize_post_target_role(value):
    allowed_roles = {'all', 'teacher', 'management', 'finance', 'hr'}
    normalized = str(value or 'all').strip().lower()
    return normalized if normalized in allowed_roles else 'all'


def _lookup_user_for_post(user_id=None, admin_id=None):
    users_map = users_ref().get() or {}
    if not isinstance(users_map, dict):
        return None, {}

    candidate_ids = [str(value) for value in (user_id, admin_id) if value]

    for candidate in candidate_ids:
        payload = users_map.get(candidate)
        if isinstance(payload, dict):
            return candidate, payload

    for uid, payload in users_map.items():
        if not isinstance(payload, dict):
            continue

        linked_codes = {
            str(payload.get('hrId') or ''),
            str(payload.get('employeeId') or ''),
            str(payload.get('username') or ''),
        }
        linked_codes.discard('')

        if any(candidate in linked_codes for candidate in candidate_ids):
            return str(uid), payload

    return None, {}


def _resolve_post_author(user_id=None, admin_id=None, fallback_name='', fallback_profile=''):
    resolved_user_id, user_payload = _lookup_user_for_post(user_id=user_id, admin_id=admin_id)
    if not isinstance(user_payload, dict):
        user_payload = {}

    resolved_admin_id = (
        admin_id
        or user_payload.get('hrId')
        or user_payload.get('employeeId')
        or user_payload.get('username')
        or resolved_user_id
        or ''
    )

    resolved_name = user_payload.get('name') or fallback_name or 'HR Office'
    resolved_profile = user_payload.get('profileImage') or fallback_profile or ''

    return {
        'userId': str(resolved_user_id or user_id or ''),
        'adminId': str(resolved_admin_id or ''),
        'hrId': str(resolved_admin_id or ''),
        'adminName': resolved_name,
        'adminProfile': resolved_profile,
    }


def _normalize_post_record(post_id, payload):
    item = dict(payload or {})
    normalized_post_id = str(item.get('postId') or item.get('id') or post_id or '')
    author_meta = _resolve_post_author(
        user_id=item.get('userId'),
        admin_id=item.get('adminId') or item.get('hrId'),
        fallback_name=item.get('adminName') or item.get('name') or '',
        fallback_profile=item.get('adminProfile') or item.get('profileImage') or '',
    )

    likes = item.get('likes') if isinstance(item.get('likes'), dict) else {}
    like_count_raw = item.get('likeCount')
    try:
        like_count = int(like_count_raw)
    except Exception:
        like_count = len(likes)

    return {
        **item,
        **author_meta,
        'postId': normalized_post_id,
        'id': normalized_post_id,
        'targetRole': _normalize_post_target_role(item.get('targetRole')),
        'likes': likes,
        'likeCount': max(like_count, len(likes)),
        'message': item.get('message') or '',
        'postUrl': item.get('postUrl') or '',
        'time': item.get('time') or item.get('createdAt') or datetime.utcnow().isoformat() + 'Z',
    }


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
        admin_id = pick('adminId', '') or pick('hrId', '') or ''
        admin_name = pick('adminName', '') or ''
        admin_profile = pick('adminProfile', '') or ''
        user_id = pick('userId', '') or admin_id or ''
        target_role = _normalize_post_target_role(pick('targetRole', 'all'))

        if not message and not post_url:
            return jsonify({'success': False, 'message': 'Post message or media is required.'}), 400

        author_meta = _resolve_post_author(
            user_id=user_id,
            admin_id=admin_id,
            fallback_name=admin_name,
            fallback_profile=admin_profile,
        )

        post_node = posts_ref().push()
        timestamp = datetime.utcnow().isoformat() + 'Z'
        post_obj = {
            'postId': post_node.key,
            'id': post_node.key,
            'adminId': author_meta['adminId'],
            'hrId': author_meta['hrId'],
            'userId': author_meta['userId'],
            'adminName': author_meta['adminName'],
            'adminProfile': author_meta['adminProfile'],
            'postUrl': post_url,
            'message': message,
            'targetRole': target_role,
            'likeCount': 0,
            'likes': {},
            'seenBy': {},
            'time': timestamp,
            'createdAt': timestamp,
            'updatedAt': timestamp,
        }
        post_node.set(post_obj)

        return jsonify({'success': True, 'post': _normalize_post_record(post_node.key, post_obj)}), 201
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


@app.route('/api/get_posts', methods=['GET'])
def get_posts():
    """Return posts as an array. Each post will include an `id` field.

    The frontend expects an array; return sorted posts (newest first) when possible.
    """
    try:
        raw = posts_ref().get() or {}
        posts = []
        if isinstance(raw, dict):
            for pid, val in raw.items():
                posts.append(_normalize_post_record(pid, val))

        try:
            posts.sort(key=lambda p: p.get('time') or '', reverse=True)
        except Exception:
            pass

        return jsonify(posts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/update_post/<post_id>', methods=['PUT', 'PATCH'])
def update_post(post_id):
    try:
        post_ref = posts_ref().child(str(post_id))
        existing = post_ref.get()
        if existing is None:
            return jsonify({'success': False, 'message': 'Post not found.'}), 404

        body = request.get_json(silent=True) or {}
        form = request.form.to_dict() if request.form else {}

        def pick(key, default=None):
            if form.get(key) is not None:
                return form.get(key)
            if body.get(key) is not None:
                return body.get(key)
            return default

        message = (pick('message', existing.get('message', '')) or '').strip()
        post_url = pick('postUrl', existing.get('postUrl', '')) or ''
        target_role = _normalize_post_target_role(pick('targetRole', existing.get('targetRole', 'all')))

        if not message and not post_url:
            return jsonify({'success': False, 'message': 'Post message or media is required.'}), 400

        update_payload = {
            'message': message,
            'postUrl': post_url,
            'targetRole': target_role,
            'updatedAt': datetime.utcnow().isoformat() + 'Z',
        }
        post_ref.update(update_payload)

        updated_post = _normalize_post_record(post_id, {**existing, **update_payload})
        return jsonify({'success': True, 'post': updated_post, 'postId': str(post_id)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/delete_post/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        post_ref = posts_ref().child(str(post_id))
        existing = post_ref.get()
        if existing is None:
            return jsonify({'success': False, 'message': 'Post not found.'}), 404

        post_ref.delete()
        return jsonify({'success': True, 'postId': str(post_id)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/like_post', methods=['POST'])
def like_post():
    try:
        payload = request.get_json() or {}
        post_id = str(payload.get('postId') or '').strip()
        actor_id = str(payload.get('userId') or payload.get('adminId') or '').strip()

        if not post_id:
            return jsonify({'success': False, 'message': 'postId is required.'}), 400
        if not actor_id:
            return jsonify({'success': False, 'message': 'userId is required.'}), 400

        post_ref = posts_ref().child(post_id)
        existing = post_ref.get()
        if existing is None:
            return jsonify({'success': False, 'message': 'Post not found.'}), 404

        existing = existing or {}
        likes = existing.get('likes') if isinstance(existing.get('likes'), dict) else {}

        if actor_id in likes:
            likes.pop(actor_id, None)
        else:
            likes[actor_id] = {
                'likedAt': datetime.utcnow().isoformat() + 'Z'
            }

        like_count = len(likes)
        update_payload = {
            'likes': likes,
            'likeCount': like_count,
            'updatedAt': datetime.utcnow().isoformat() + 'Z',
        }
        post_ref.update(update_payload)

        updated_post = _normalize_post_record(post_id, {**existing, **update_payload})
        return jsonify({
            'success': True,
            'post': updated_post,
            'postId': post_id,
            'likes': likes,
            'likeCount': like_count,
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/posts/mark_seen', methods=['POST'])
def mark_posts_seen():
    try:
        payload = request.get_json(silent=True) or {}
        actor_id = str(payload.get('userId') or payload.get('adminId') or '').strip()
        post_ids = payload.get('postIds') or []

        if not actor_id:
            return jsonify({'success': False, 'message': 'userId is required.'}), 400
        if not isinstance(post_ids, list) or not post_ids:
            return jsonify({'success': True, 'updated': 0, 'postIds': []}), 200

        updated_ids = []
        seen_at = datetime.utcnow().isoformat() + 'Z'

        for raw_post_id in post_ids:
            post_id = str(raw_post_id or '').strip()
            if not post_id:
                continue

            post_ref = posts_ref().child(post_id)
            existing = post_ref.get()
            if existing is None:
                continue

            seen_by = existing.get('seenBy') if isinstance(existing.get('seenBy'), dict) else {}
            seen_by[actor_id] = seen_at
            post_ref.update({
                'seenBy': seen_by,
                'updatedAt': seen_at,
            })
            updated_ids.append(post_id)

        return jsonify({'success': True, 'updated': len(updated_ids), 'postIds': updated_ids}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/register/<role>', methods=['POST'])
def register_role(role):
    import time
    role = str(role or '').strip().lower()
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

    # --- FIX: Generate role code and upload profile image to correct path ---
    timestamp = str(int(time.time()))
    emp_code = generate_employee_code()
    teacher_code = generate_teacher_code() if role == 'teacher' else None
    management_code = generate_management_code() if role == 'management' else None
    finance_code = generate_finance_code() if role == 'finance' else None
    hr_code = generate_hr_code() if role == 'hr' else None
    role_code = (
        teacher_code if role == 'teacher' else
        management_code if role == 'management' else
        finance_code if role == 'finance' else
        hr_code if role == 'hr' else
        emp_code
    )
    role_folder = (
        'Teacher' if role == 'teacher' else
        'Management' if role == 'management' else
        'Finance' if role == 'finance' else
        'HR' if role == 'hr' else
        'Other'
    )
    profile_image_url = ''
    if 'profile' in files:
        file = files['profile']
        ext = os.path.splitext(secure_filename(file.filename))[1] or '.jpg'
        storage_path = f'{role_folder}/{role_code}_{timestamp}_profile{ext}'
        bucket = get_storage_bucket()
        import tempfile
        tmp = tempfile.NamedTemporaryFile(delete=False)
        tmp.close()  # Close the file so it can be written by file.save()
        file.save(tmp.name)
        blob = bucket.blob(storage_path)
        blob.upload_from_filename(tmp.name, content_type=file.mimetype)
        os.unlink(tmp.name)  # Clean up temp file
        blob.make_public()
        profile_image_url = blob.public_url
    elif form.get('profileImage'):
        profile_image_url = form.get('profileImage')
    else:
        profile_image_url = profile_json.get('personal', {}).get('profileImageName', '')
    # --- END FIX ---

    # Special case: 'other' role (gate keepers, cleaners, etc.)
    if role == 'other':
        # Only store in Employees node, not Users or role nodes
        employee_payload = {'profileData': profile_json}
        # Store image URL in personal.profileImageName
        if 'personal' not in employee_payload['profileData']:
            employee_payload['profileData']['personal'] = {}
        employee_payload['profileData']['personal']['profileImageName'] = profile_image_url
        exclude_keys = {'profileData', 'role', 'name', 'password', 'email', 'username', 'profileImage', 'status', 'isActive', 'userId'}
        for k, v in form.items():
            if k not in exclude_keys:
                employee_payload[k] = v
        if isinstance(profile_json, dict):
            for section in ('personal', 'contact', 'education', 'family', 'job', 'financial'):
                if section in profile_json:
                    employee_payload[section] = profile_json[section]
        employee_payload = sanitize_employee_payload(employee_payload)
        emp_key = emp_code
        employees_ref().child(emp_key).set(employee_payload)
        return jsonify({'success': True, 'message': 'Registered (other)', 'employeeId': emp_key, 'profileImageUrl': profile_image_url}), 201
    # ...existing code for other roles...
    # create user
    # Set username and role id field based on role
    user_payload = {
        'username': role_code,  # username is always the role id
        'name': name,
        'password': password,
        'role': role,
        'email': email,
        'gender': profile_json.get('personal', {}).get('gender', ''),
        'phone': form.get('phone') or profile_json.get('contact', {}).get('phone', ''),
        'isActive': True,
        'profileImage': profile_image_url,
    }
    # Add the correct role id field
    if role == 'teacher':
        user_payload['teacherId'] = role_code
    elif role == 'management':
        user_payload['managementId'] = role_code
    elif role == 'finance':
        user_payload['financeId'] = role_code
    elif role == 'hr':
        user_payload['hrId'] = role_code
    user_node = users_ref().push(user_payload)
    user_id = user_node.key
    # Add employeeId and schoolCode to user
    emp_id = emp_code
    users_ref().child(user_id).update({
        'employeeId': emp_id,
        # store the school's short name instead of the internal school code
        'schoolCode': get_school_shortname()
    })

    # create employee record first
    # Add the correct role id field in employee node
    if role == 'teacher':
        employee_payload = {'userId': user_id, 'teacherId': teacher_code, 'profileData': profile_json}
    elif role == 'management':
        employee_payload = {'userId': user_id, 'managementId': management_code, 'profileData': profile_json}
    elif role == 'finance':
        employee_payload = {'userId': user_id, 'financeId': finance_code, 'profileData': profile_json}
    elif role == 'hr':
        employee_payload = {'userId': user_id, 'hrId': hr_code, 'profileData': profile_json}
    else:
        employee_payload = {'userId': user_id, 'profileData': profile_json}
    # Store image URL in personal.profileImageName
    if 'personal' not in employee_payload['profileData']:
        employee_payload['profileData']['personal'] = {}
    employee_payload['profileData']['personal']['profileImageName'] = profile_image_url

    exclude_keys = {'profileData', 'role', 'name', 'password', 'email', 'username', 'profileImage', 'status', 'isActive', 'userId'}
    for k, v in form.items():
        if k not in exclude_keys:
            employee_payload[k] = v

    if isinstance(profile_json, dict):
        for section in ('personal', 'contact', 'education', 'family', 'job', 'financial'):
            if section in profile_json:
                employee_payload[section] = profile_json[section]

    employee_payload = sanitize_employee_payload(employee_payload)
    # persist employee under formatted key
    # Employees node key is always employee id
    emp_key = emp_code
    employees_ref().child(emp_key).set(employee_payload)

    # create role node with role id as key, and employeeId as EMP_xxx
    role_payload = {'userId': user_id, 'employeeId': emp_key, 'status': form.get('status', 'active')}
    if role == 'teacher':
        teachers_ref().child(teacher_code).set(role_payload)
    elif role == 'finance':
        finances_ref().child(finance_code).set(role_payload)
    elif role == 'management':
        managements_ref().child(management_code).set(role_payload)
    elif role == 'hr':
        hrs_ref().child(hr_code).set(role_payload)
    else:
        pass

    return jsonify({'success': True, 'message': 'Registered', 'userId': user_id, 'roleId': emp_key, 'employeeId': emp_key, 'profileImageUrl': profile_image_url}), 201


@app.route('/employees/<emp_id>', methods=['GET'])
def get_employee(emp_id):
    data = ref().child(emp_id).get()
    if data is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify(data)


@app.route('/employees/<emp_id>', methods=['PUT'])
def update_employee(emp_id):
    payload = request.get_json() or {}
    payload = sanitize_employee_payload(payload)
    ref().child(emp_id).update(payload)
    return jsonify({'ok': True})


@app.route('/employees/<emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    return jsonify({
        'ok': False,
        'error': 'hard delete disabled',
        'message': 'Use POST /employees/<emp_id>/terminate to preserve the employee record and remove linked access records.',
    }), 405


@app.route('/employees/<emp_id>/terminate', methods=['POST'])
def terminate_employee(emp_id):
    employee_ref = ref().child(emp_id)
    employee_data = employee_ref.get()

    if employee_data is None:
        return jsonify({'ok': False, 'error': 'employee not found'}), 404

    if not isinstance(employee_data, dict):
        employee_data = {}

    user_id = employee_data.get('userId')
    user_data = {}

    if user_id:
        user_data = users_ref().child(user_id).get() or {}
        users_ref().child(user_id).delete()

    # Fallback: remove any users linked by employeeId
    all_users = users_ref().get() or {}
    removed_user_ids = []
    if user_id:
        removed_user_ids.append(str(user_id))

    if isinstance(all_users, dict):
        for uid, payload in all_users.items():
            if not isinstance(payload, dict):
                continue
            if str(payload.get('employeeId') or '') == str(emp_id):
                users_ref().child(uid).delete()
                removed_user_ids.append(str(uid))

    removed_roles = _remove_role_nodes_for_employee(emp_id, employee_data=employee_data, user_data=user_data)

    employee_ref.child('status').set('Terminated')
    employee_ref.child('terminatedAt').set(datetime.utcnow().isoformat() + 'Z')
    employee_ref.child('isActive').set(False)
    # Get HR id from request (must be provided in POST body as 'hrId', 'hrID', 'adminId', or 'adminID')
    hrid = None
    try:
        data = request.get_json(force=True)
        hrid = data.get('hrId') or data.get('hrID') or data.get('adminId') or data.get('adminID')
    except Exception:
        hrId = None
    # If not found, fallback to userId (legacy, but not preferred)
    if not hrid:
        hrId = user_id
    # Store gender in Employees node if available
    gender = None
    personal = employee_data.get('personal') or (employee_data.get('profileData') or {}).get('personal') or {}
    gender = personal.get('gender') or employee_data.get('gender')
    if gender:
        employee_ref.child('gender').set(gender)
    if hrid:
        
        employee_ref.child('terminatedBy').set(hrid)

    # Mark nested job status too, when available.
    if isinstance(employee_data.get('job'), dict):
        employee_ref.child('job').child('status').set('Terminated')
    if isinstance((employee_data.get('profileData') or {}).get('job'), dict):
        employee_ref.child('profileData').child('job').child('status').set('Terminated')

    return jsonify({
        'ok': True,
        'employeeId': emp_id,
        'removedUsers': removed_user_ids,
        'removedRoleNodes': removed_roles,
    }), 200


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


@app.route('/api/employee_attendance/history', methods=['GET'])
def get_employee_attendance_history():
    data = employees_attendance_ref().get() or {}
    if not isinstance(data, dict):
        data = {}

    return jsonify({'ok': True, 'attendanceByDate': data}), 200



@app.route('/employees/<emp_id>/reactivate', methods=['POST'])
def reactivate_employee(emp_id):
    employee_ref = ref().child(emp_id)
    employee_data = employee_ref.get()
    if employee_data is None:
        return jsonify({'ok': False, 'error': 'employee not found'}), 404

    # Restore status fields
    employee_ref.child('status').set('Active')
    employee_ref.child('isActive').set(True)
    employee_ref.child('terminatedAt').delete()
    if isinstance(employee_data.get('job'), dict):
        employee_ref.child('job').child('status').set('Active')
    if isinstance((employee_data.get('profileData') or {}).get('job'), dict):
        employee_ref.child('profileData').child('job').child('status').set('Active')

    # Re-create Users node and role node as in registration
    job = employee_data.get('job') or (employee_data.get('profileData') or {}).get('job') or {}
    contact = employee_data.get('contact') or (employee_data.get('profileData') or {}).get('contact') or {}
    personal = employee_data.get('personal') or (employee_data.get('profileData') or {}).get('personal') or {}
    # Compose name from personal fields if not present
    name = employee_data.get('name') or employee_data.get('fullName')
    if not name:
        first = personal.get('firstName', '')
        middle = personal.get('middleName', '')
        last = personal.get('lastName', '')
        name = ' '.join([first, middle, last]).strip()
        if not name:
            name = (first or last or middle)
    email = contact.get('email') or contact.get('altEmail') or employee_data.get('email') or ''
    profile_image = employee_data.get('profileImage') or personal.get('profileImageName') or ''
    role = None
    role_id = None
    if employee_data.get('teacherId') or job.get('employeeCategory') == 'Teacher' or job.get('position') == 'teacher':
        role = 'teacher'
        role_id = generate_teacher_code()
    elif employee_data.get('managementId') or job.get('employeeCategory') == 'Management' or job.get('position') == 'management':
        role = 'management'
        role_id = generate_management_code()
    elif employee_data.get('financeId') or job.get('employeeCategory') == 'Finance' or job.get('position') == 'finance':
        role = 'finance'
        role_id = generate_finance_code()
    elif employee_data.get('hrId') or job.get('employeeCategory') == 'HR' or job.get('position') == 'hr':
        role = 'hr'
        role_id = generate_hr_code()
    # Always store gender with value (never empty string)
    gender = personal.get('gender', '')
    if not gender:
        gender = employee_data.get('gender', '') or 'unknown'
    # Store gender in Employees node
    employee_ref.child('gender').set(gender)
    # Get HR/admin id robustly from request (hrId, hrID, adminId, adminID, fallback to userId)
    activated_by = None
    try:
        data = request.get_json(force=True)
        for key in ['hrId', 'hrID', 'adminId', 'adminID']:
            if data.get(key):
                activated_by = data.get(key)
                break
        if not activated_by:
            activated_by = data.get('userId')
    except Exception:
        activated_by = None
    if activated_by:
        employee_ref.child('activatedBy').set(activated_by)
    user_payload = {
        'username': role_id or emp_id,
        'name': name,
        'password': employee_data.get('password', 'password123'),
        'role': role,
        'isActive': True,
        'profileImage': profile_image,
        'email': email,
        'employeeId': emp_id,
        'gender': gender,
        'phone': contact.get('phone') or contact.get('phone1') or contact.get('phone2') or '',
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key
    employee_ref.child('userId').set(user_id)

    # Re-create role node if role is known
    role_node_id = None
    if role == 'teacher':
        teacher_payload = {
            'userId': user_id,
            'employeeId': emp_id,
            'status': 'active',
            'profileImage': profile_image,
            'teacherId': role_id,
        }
        teachers_ref().child(role_id).set(teacher_payload)
        employee_ref.child('teacherId').set(role_id)
        users_ref().child(user_id).update({'teacherId': role_id, 'employeeId': emp_id, 'username': role_id})
        role_node_id = role_id
    elif role == 'management':
        management_payload = {
            'userId': user_id,
            'employeeId': emp_id,
            'status': 'active',
            'profileImage': profile_image,
            'managementId': role_id,
        }
        managements_ref().child(role_id).set(management_payload)
        employee_ref.child('managementId').set(role_id)
        users_ref().child(user_id).update({'managementId': role_id, 'employeeId': emp_id, 'username': role_id})
        role_node_id = role_id
    elif role == 'finance':
        finance_payload = {
            'userId': user_id,
            'employeeId': emp_id,
            'status': 'active',
            'profileImage': profile_image,
            'financeId': role_id,
        }
        finances_ref().child(role_id).set(finance_payload)
        employee_ref.child('financeId').set(role_id)
        users_ref().child(user_id).update({'financeId': role_id, 'employeeId': emp_id, 'username': role_id})
        role_node_id = role_id
    elif role == 'hr':
        hr_payload = {
            'userId': user_id,
            'employeeId': emp_id,
            'status': 'active',
            'profileImage': profile_image,
            'hrId': role_id,
        }
        hrs_ref().child(role_id).set(hr_payload)
        employee_ref.child('hrId').set(role_id)
        users_ref().child(user_id).update({'hrId': role_id, 'employeeId': emp_id, 'username': role_id})
        role_node_id = role_id

    return jsonify({'ok': True, 'employeeId': emp_id, 'userId': user_id, 'role': role, 'roleNodeId': role_node_id}), 200


@app.route('/employees/<emp_id>/upload_profile_image', methods=['POST'])
def upload_employee_profile_image(emp_id):
    if 'profile' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400
    file = request.files['profile']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400
    # Upload to Firebase Storage
    url = upload_profile_image_to_storage(file, emp_id)
    # Update employee record with the image URL
    emp_ref = ref().child(emp_id)
    emp_data = emp_ref.get() or {}
    # Update both top-level and nested profileData if present
    emp_ref.child('personal/profileImageName').set(url)
    if 'profileData' in emp_data and isinstance(emp_data['profileData'], dict):
        emp_ref.child('profileData/personal/profileImageName').set(url)
    # Optionally update top-level profileImage
    emp_ref.child('profileImage').set(url)
    return jsonify({'profileImageUrl': url})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
