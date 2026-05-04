from flask import Flask, request, jsonify, has_request_context
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
from firebase_config import FIREBASE_CREDENTIALS, FIREBASE_STORAGE_BUCKET, get_firebase_options, require_firebase_credentials

import os
from datetime import datetime, timedelta
from functools import lru_cache
import re
import tempfile
from werkzeug.utils import secure_filename
from firebase_admin import storage


app = Flask(__name__)
CORS(app)

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
    for key in ('hrId', 'teacherId', 'schoolAdminId', 'managementId', 'financeId', 'username', 'employeeId'):
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


def upload_post_media_to_storage(file_storage, owner_id):
    if not file_storage:
        return ''

    bucket = get_storage_bucket()
    if bucket is None:
        raise RuntimeError('Storage bucket not available. Ensure FIREBASE_STORAGE_BUCKET and credentials are configured.')

    filename = secure_filename(file_storage.filename or '')
    ext = os.path.splitext(filename)[1] if filename else ''
    if not ext:
        mimetype = getattr(file_storage, 'mimetype', '') or 'application/octet-stream'
        ext_guess = mimetype.split('/')[-1] if '/' in mimetype else 'bin'
        ext = f'.{ext_guess}'

    safe_owner_id = secure_filename(str(owner_id or 'hr-admin')) or 'hr-admin'
    timestamp = str(int(datetime.utcnow().timestamp()))
    storage_filename = f'{safe_owner_id}_{timestamp}_post{ext}'
    storage_path = f'HR/Posts/{storage_filename}'
    blob = bucket.blob(storage_path)

    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp_path = tmp.name
    try:
        tmp.close()
        try:
            file_storage.save(tmp_path)
        except Exception as ex:
            raise RuntimeError(f'Failed saving incoming post media to temp path: {ex}')

        try:
            blob.upload_from_filename(tmp_path, content_type=file_storage.mimetype)
        except Exception as ex:
            raise RuntimeError(f'Failed uploading post media to storage: {ex}')
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    try:
        blob.make_public()
    except Exception as ex:
        raise RuntimeError(f'Uploaded post media but failed to make object public: {ex}')

    return blob.public_url

# Initialize Firebase Admin
cred_path = require_firebase_credentials()
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred, get_firebase_options())

ROOT = 'Employees'
PLATFORM_ROOT = (os.getenv('PLATFORM_ROOT') or 'Platform1').strip()
SCHOOLS_ROOT = 'Schools'
DEFAULT_SCHOOL_CODE = (os.getenv('SCHOOL_CODE') or 'ET-ORO-ADA-GMI').strip()

if not DEFAULT_SCHOOL_CODE:
    raise RuntimeError('SCHOOL_CODE cannot be empty.')


@lru_cache(maxsize=1)
def platform_root_ref():
    platform_ref = db.reference(PLATFORM_ROOT)
    if platform_ref.get() is None:
        raise RuntimeError(
            f"Missing '{PLATFORM_ROOT}' root in Realtime Database."
        )

    return platform_ref


@lru_cache(maxsize=1)
def schools_root():
    platform_ref = platform_root_ref()

    schools_ref = platform_ref.child(SCHOOLS_ROOT)
    if schools_ref.get() is None:
        raise RuntimeError(
            f"Missing '{PLATFORM_ROOT}/{SCHOOLS_ROOT}' root in Realtime Database. Existing node is required."
        )

    return schools_ref


@lru_cache(maxsize=1)
def school_code_index_ref():
    return platform_root_ref().child('schoolCodeIndex')


@lru_cache(maxsize=1)
def school_code_index_map():
    index_data = school_code_index_ref().get() or {}
    return index_data if isinstance(index_data, dict) else {}


def _normalize_school_code(value):
    return str(value or '').strip()


def _extract_school_shortname(school_node):
    if not isinstance(school_node, dict):
        return ''

    school_info = school_node.get('schoolInfo')
    if not isinstance(school_info, dict):
        school_info = school_node.get('schoolinfo')

    if isinstance(school_info, dict):
        for key in ('shortName', 'shortname', 'short', 'short_name'):
            value = _normalize_school_code(school_info.get(key)).upper()
            if value:
                return value

    return ''


def resolve_school_code(value, default=None):
    requested_school_code = _normalize_school_code(value or default or DEFAULT_SCHOOL_CODE)
    if not requested_school_code:
        return ''

    schools = schools_root().get() or {}
    if not isinstance(schools, dict):
        return requested_school_code

    if requested_school_code in schools:
        return requested_school_code

    short_key = requested_school_code.upper()
    mapped_school_code = _normalize_school_code(school_code_index_map().get(short_key))
    if mapped_school_code and mapped_school_code in schools:
        return mapped_school_code

    for school_code, school_node in schools.items():
        if _extract_school_shortname(school_node) == short_key:
            return str(school_code)

    return requested_school_code


def _get_payload_school_code(payload):
    if not isinstance(payload, dict):
        return ''

    for key in ('schoolCode', 'school_code'):
        school_code = _normalize_school_code(payload.get(key))
        if school_code:
            return school_code

    return ''


def get_requested_school_code():
    if not has_request_context():
        return ''

    for value in (
        request.headers.get('X-School-Code'),
        request.headers.get('X-SchoolCode'),
        request.args.get('schoolCode'),
        request.args.get('school_code'),
    ):
        school_code = _normalize_school_code(value)
        if school_code:
            return school_code

    payload = request.get_json(silent=True) if request.is_json else None
    school_code = _get_payload_school_code(payload)
    if school_code:
        return school_code

    for value in (
        request.form.get('schoolCode'),
        request.form.get('school_code'),
    ):
        school_code = _normalize_school_code(value)
        if school_code:
            return school_code

    return ''


def get_active_school_code(default=None):
    school_code = resolve_school_code(get_requested_school_code() or default or DEFAULT_SCHOOL_CODE)
    if not school_code:
        raise RuntimeError('School code could not be resolved for this request.')

    return school_code


@lru_cache(maxsize=128)
def school_root_for(school_code):
    normalized_school_code = resolve_school_code(school_code, DEFAULT_SCHOOL_CODE)
    school_ref = schools_root().child(normalized_school_code)
    if school_ref.get() is None:
        raise RuntimeError(
            f"School node '{PLATFORM_ROOT}/{SCHOOLS_ROOT}/{normalized_school_code}' does not exist. "
            "Set SCHOOL_CODE to an existing school code."
        )

    return school_ref


def school_root():
    return school_root_for(get_active_school_code())


def find_user_across_schools(username):
    normalized_username = str(username or '').strip()
    if not normalized_username:
        return None, None, None

    schools = schools_root().get() or {}
    if not isinstance(schools, dict):
        return None, None, None

    for school_code in schools.keys():
        matched_users = (
            schools_root()
            .child(str(school_code))
            .child('Users')
            .order_by_child('username')
            .equal_to(normalized_username)
            .limit_to_first(1)
            .get()
            or {}
        )
        if not isinstance(matched_users, dict):
            continue

        for uid, user in matched_users.items():
            if not isinstance(user, dict):
                continue
            if str(user.get('username') or '').strip() == normalized_username:
                return str(school_code), str(uid), user

    return None, None, None

def ref():
    return school_root().child(ROOT)

def users_ref():
    return school_root().child('Users')

def teachers_ref():
    return school_root().child('Teachers')

def employees_ref():
    return school_root().child('Employees')


def school_admins_ref():
    return school_root().child(SCHOOL_ADMINS_NODE)


def legacy_managements_ref():
    return school_root().child(LEGACY_MANAGEMENT_NODE)


def managements_ref():
    return school_admins_ref()


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


def employee_summaries_ref():
    return school_root().child('EmployeeSummaries')


def employee_terminations_ref():
    return school_root().child('Employee_terminations')


def departments_ref():
    return school_root().child('Departments')


def positions_ref():
    return school_root().child('Positions')


def counters_ref():
    return school_root().child('_meta').child('counters')


def _remove_role_nodes_for_employee(emp_id, employee_data=None, user_data=None):
    employee_data = employee_data or {}
    user_data = user_data or {}

    role_specs = [
        (('teacherId',), (teachers_ref,)),
        (SCHOOL_ADMIN_ID_KEYS, (school_admins_ref, legacy_managements_ref)),
        (('financeId',), (finances_ref,)),
        (('hrId',), (hrs_ref,)),
    ]

    removed_nodes = []

    for role_keys, ref_factories in role_specs:
        target_role_code = _get_first_nonempty(employee_data, *role_keys) or _get_first_nonempty(user_data, *role_keys)

        for ref_factory in ref_factories:
            role_ref = ref_factory()
            role_nodes = role_ref.get() or {}
            if not isinstance(role_nodes, dict):
                continue

            for node_key, node_value in role_nodes.items():
                node_payload = node_value or {}
                if not isinstance(node_payload, dict):
                    continue

                node_employee_id = str(node_payload.get('employeeId') or '')
                node_role_code = str(_get_first_nonempty(node_payload, *role_keys) or node_key or '')
                should_remove = node_employee_id == str(emp_id)

                if not should_remove and target_role_code:
                    should_remove = node_role_code == str(target_role_code) or str(node_key) == str(target_role_code)

                if should_remove:
                    role_ref.child(node_key).delete()
                    removed_nodes.append({'role': role_keys[0], 'nodeKey': node_key})

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


def _coerce_bool_arg(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ('1', 'true', 'yes', 'y', 'on')


def _coerce_non_negative_int(value, default=None, max_value=None):
    if value is None:
        return default

    raw = str(value).strip()
    if not raw:
        return default

    try:
        parsed = int(raw)
    except Exception:
        return default

    if parsed < 0:
        parsed = 0

    if max_value is not None:
        parsed = min(parsed, max_value)

    return parsed


def _normalize_reference_name(value):
    return ' '.join(str(value or '').strip().split())


def _normalize_department_status(value):
    normalized = str(value or 'active').strip().lower()
    if normalized not in ('active', 'inactive'):
        return 'active'
    return normalized


def _build_reference_key(prefix, name, existing_keys=None):
    normalized = re.sub(r'[^A-Za-z0-9]+', '_', str(name or '').upper()).strip('_')
    base_key = normalized or datetime.utcnow().strftime('%Y%m%d%H%M%S')
    candidate = f'{prefix}_{base_key}'
    existing = {str(key) for key in (existing_keys or [])}
    if candidate not in existing:
        return candidate

    suffix = 2
    while f'{candidate}_{suffix}' in existing:
        suffix += 1
    return f'{candidate}_{suffix}'


def _safe_children_count(ref_factory):
    try:
        data = ref_factory().get() or {}
    except Exception:
        return 0

    if isinstance(data, dict):
        return len([key for key in data.keys() if str(key) != '_meta'])
    if isinstance(data, list):
        return len([item for item in data if item is not None])
    return 0


def _next_counter_value(counter_name, ref_factory):
    counter_ref = counters_ref().child(counter_name)
    current_counter_value = counter_ref.get()
    baseline = _safe_children_count(ref_factory) if current_counter_value is None else None

    def increment(current_value):
        if current_value is None:
            return max(0, baseline or 0) + 1

        try:
            parsed_value = int(current_value)
        except Exception:
            parsed_value = max(0, baseline or 0)

        return parsed_value + 1

    next_value = counter_ref.transaction(increment)
    try:
        return int(next_value)
    except Exception:
        return max(1, baseline + 1)


def generate_employee_code():
    year_suffix = datetime.now().year % 100
    emp_seq = _next_counter_value('employees', employees_ref)
    return f"EMP_{emp_seq:04d}_{year_suffix}"


def generate_termination_code():
    year_suffix = datetime.now().year % 100
    termination_seq = _next_counter_value('employee_terminations', employee_terminations_ref)
    return f"TERM_{termination_seq:04d}_{year_suffix}"


def sync_employee_termination_meta():
    raw = employee_terminations_ref().get() or {}
    terminated_counter = 0

    if isinstance(raw, dict):
        terminated_counter = len([
            termination_id
            for termination_id, payload in raw.items()
            if str(termination_id) != '_meta' and isinstance(payload, dict)
        ])
    elif isinstance(raw, list):
        terminated_counter = len([payload for payload in raw if isinstance(payload, dict)])

    meta_payload = {
        'terminatedCounter': terminated_counter,
        'updatedAt': datetime.utcnow().isoformat() + 'Z',
    }
    employee_terminations_ref().child('_meta').set(meta_payload)
    return meta_payload


def _resolve_department_name(value):
    department_value = str(value or '').strip()
    if not department_value:
        return ''

    try:
        department_payload = departments_ref().child(department_value).get() or {}
    except Exception:
        department_payload = {}

    if isinstance(department_payload, dict) and department_payload.get('name'):
        return str(department_payload.get('name') or '').strip() or department_value

    return department_value


def _resolve_termination_actor_details(actor_value):
    actor_value = str(actor_value or '').strip()
    if not actor_value:
        return '', ''

    resolved_employee_id = ''

    if actor_value.startswith('EMP_'):
        resolved_employee_id = actor_value
    else:
        for ref_factory in (hrs_ref, managements_ref, finances_ref, teachers_ref):
            try:
                role_payload = ref_factory().child(actor_value).get() or {}
            except Exception:
                role_payload = {}
            if isinstance(role_payload, dict) and role_payload.get('employeeId'):
                resolved_employee_id = str(role_payload.get('employeeId') or '').strip()
                break

    if not resolved_employee_id:
        try:
            user_payload = users_ref().child(actor_value).get() or {}
        except Exception:
            user_payload = {}
        if isinstance(user_payload, dict) and user_payload.get('employeeId'):
            resolved_employee_id = str(user_payload.get('employeeId') or '').strip()

    actor_name = ''
    if resolved_employee_id:
        try:
            summary_payload = employee_summaries_ref().child(resolved_employee_id).get() or {}
        except Exception:
            summary_payload = {}
        if isinstance(summary_payload, dict):
            actor_name = str(summary_payload.get('fullName') or summary_payload.get('name') or '').strip()

    if not actor_name:
        try:
            user_payload = users_ref().child(actor_value).get() or {}
        except Exception:
            user_payload = {}
        if isinstance(user_payload, dict):
            actor_name = str(user_payload.get('name') or '').strip()

    return resolved_employee_id, actor_name


def get_school_shortname():
    """Return the school's shortname stored under schoolinfo.shortname (uppercased).

    Falls back to the active school code if not present.
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
    return re.sub(r'[^A-Za-z0-9]', '', get_active_school_code()).upper()


def generate_teacher_code():
    year_suffix = datetime.now().year % 100
    teacher_seq = _next_counter_value('teachers', teachers_ref)
    short = get_school_shortname()
    return f"{short}T_{teacher_seq:04d}_{year_suffix:02d}"


def generate_school_admin_code():
    year_suffix = datetime.now().year % 100
    mgmt_seq = _next_counter_value('management', managements_ref)
    short = get_school_shortname()
    return f"{short}A_{mgmt_seq:04d}_{year_suffix:02d}"


def generate_management_code():
    return generate_school_admin_code()


def generate_finance_code():
    year_suffix = datetime.now().year % 100
    fin_seq = _next_counter_value('finance', finances_ref)
    short = get_school_shortname()
    return f"{short}F_{fin_seq:04d}_{year_suffix:02d}"


def generate_hr_code():
    year_suffix = datetime.now().year % 100
    hr_seq = _next_counter_value('hr', hrs_ref)
    short = get_school_shortname()
    return f"{short}H_{hr_seq:04d}_{year_suffix:02d}"


def sanitize_employee_payload(emp_payload: dict):
    """Strip unwanted fields from an Employees payload.

    Removes top-level 'courses', 'gender', 'phone', 'phone1', 'phone2'.
    Preserves nested `personal.gender` because the new employee structure stores gender there.
    Removes invalid gender fields from contact sections.
    """
    if not isinstance(emp_payload, dict):
        return emp_payload

    # remove top-level keys
    for k in ('courses', 'gender', 'phone', 'phone1', 'phone2'):
        emp_payload.pop(k, None)

    # sanitize top-level contact: remove gender but keep phone1/phone2
    if isinstance(emp_payload.get('contact'), dict):
        emp_payload['contact'].pop('gender', None)

    # sanitize profileData if present
    pd = emp_payload.get('profileData')
    if isinstance(pd, dict):
        if isinstance(pd.get('contact'), dict):
            pd['contact'].pop('gender', None)
        emp_payload['profileData'] = pd

    return emp_payload


def _merge_employee_section(target, incoming):
    if not isinstance(incoming, dict):
        return target
    for key, value in incoming.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        target[key] = value
    return target


def _get_employee_employment_data(payload):
    payload = payload if isinstance(payload, dict) else {}
    profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}

    merged = {}
    for source in (
        profile_data.get('job'),
        profile_data.get('employment'),
        payload.get('job'),
        payload.get('employment'),
    ):
        _merge_employee_section(merged, source)

    if merged.get('category') and not merged.get('employeeCategory'):
        merged['employeeCategory'] = merged.get('category')
    if merged.get('employeeCategory') and not merged.get('category'):
        merged['category'] = merged.get('employeeCategory')
    return merged


def _get_employee_job_data(payload, employment=None, emp_id=None):
    payload = payload if isinstance(payload, dict) else {}
    profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}

    merged = {}
    for source in (
        profile_data.get('job'),
        payload.get('job'),
    ):
        _merge_employee_section(merged, source)

    employment = employment if isinstance(employment, dict) else {}
    resolved_employee_id = (
        merged.get('employeeId')
        or employment.get('employeeId')
        or payload.get('employeeId')
        or emp_id
        or ''
    )
    if resolved_employee_id and not merged.get('employeeId'):
        merged['employeeId'] = resolved_employee_id

    resolved_category = (
        merged.get('employeeCategory')
        or merged.get('category')
        or employment.get('employeeCategory')
        or employment.get('category')
        or ''
    )
    if resolved_category and not merged.get('employeeCategory'):
        merged['employeeCategory'] = resolved_category
    if resolved_category and not merged.get('category'):
        merged['category'] = resolved_category

    if employment.get('departmentId') and not merged.get('departmentId'):
        merged['departmentId'] = employment.get('departmentId')
    if employment.get('department') and not merged.get('department'):
        merged['department'] = employment.get('department')
    if employment.get('positionId') and not merged.get('positionId'):
        merged['positionId'] = employment.get('positionId')
    if employment.get('position') and not merged.get('position'):
        merged['position'] = employment.get('position')

    return merged


def _get_employee_meta_data(payload):
    payload = payload if isinstance(payload, dict) else {}
    profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}
    merged = {}
    _merge_employee_section(merged, profile_data.get('meta'))
    _merge_employee_section(merged, payload.get('meta'))
    if payload.get('userId') and not merged.get('userId'):
        merged['userId'] = payload.get('userId')
    return merged


def _get_linked_user_id(payload):
    payload = payload if isinstance(payload, dict) else {}
    meta = _get_employee_meta_data(payload)
    user_id = meta.get('userId') or payload.get('userId')
    return str(user_id or '').strip()


def normalize_employee_document(payload, emp_id=None, user_id=None, include_legacy_nodes=True):
    payload = dict(payload or {})
    profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}
    profile_data = dict(profile_data or {})

    for section in ('personal', 'contact', 'education', 'family', 'financial'):
        top_level_section = payload.get(section) if isinstance(payload.get(section), dict) else {}
        profile_section = profile_data.get(section) if isinstance(profile_data.get(section), dict) else {}
        merged_section = {}
        if section == 'personal':
            top_level_gender = payload.get('gender')
            normalized_gender = _normalize_gender(top_level_gender) or (str(top_level_gender).strip().lower() if top_level_gender else '')
            if normalized_gender and not top_level_section.get('gender') and not profile_section.get('gender'):
                merged_section['gender'] = normalized_gender
            if emp_id and not top_level_section.get('employeeId') and not profile_section.get('employeeId'):
                merged_section['employeeId'] = emp_id
        _merge_employee_section(merged_section, profile_section)
        _merge_employee_section(merged_section, top_level_section)
        if merged_section:
            payload[section] = merged_section
            if include_legacy_nodes:
                profile_data[section] = dict(merged_section)

    employment = _get_employee_employment_data({**payload, 'profileData': profile_data})
    if emp_id and not employment.get('employeeId'):
        employment['employeeId'] = emp_id
    if employment:
        payload['employment'] = dict(employment)
        if include_legacy_nodes:
            profile_data['employment'] = dict(payload['employment'])

    if include_legacy_nodes:
        job = _get_employee_job_data({**payload, 'profileData': profile_data}, employment, emp_id)
        if job:
            payload['job'] = dict(job)
            profile_data['job'] = dict(payload['job'])
        elif employment:
            payload['job'] = {
                'employeeId': employment.get('employeeId') or emp_id or '',
                'employeeCategory': employment.get('employeeCategory') or employment.get('category') or '',
                'category': employment.get('category') or employment.get('employeeCategory') or '',
            }
            profile_data['job'] = dict(payload['job'])
    else:
        payload.pop('job', None)

    meta = _get_employee_meta_data({**payload, 'profileData': profile_data})
    effective_user_id = user_id or payload.get('userId') or meta.get('userId')
    if effective_user_id:
        payload['userId'] = effective_user_id
        if include_legacy_nodes:
            meta['userId'] = effective_user_id
    if include_legacy_nodes and meta:
        payload['meta'] = dict(meta)
        profile_data['meta'] = dict(meta)
    else:
        payload.pop('meta', None)

    if include_legacy_nodes and profile_data:
        payload['profileData'] = profile_data
    else:
        payload.pop('profileData', None)
    return payload


LEGACY_EMPLOYEE_FIELDS = ('job', 'profileData', 'meta', 'managementId', 'financeId', 'financialId')


def normalize_clean_employee_document(payload, emp_id=None, user_id=None):
    payload = normalize_employee_document(payload, emp_id, user_id, include_legacy_nodes=False)
    payload = sanitize_employee_payload(payload)
    for key in LEGACY_EMPLOYEE_FIELDS:
        payload.pop(key, None)
    return payload


def build_registration_employee_payload(source_payload, emp_id=None, user_id=None, role=None, role_code=None, profile_image_url=''):
    source_payload = source_payload if isinstance(source_payload, dict) else {}
    profile_data = source_payload.get('profileData') if isinstance(source_payload.get('profileData'), dict) else {}

    employee_payload = {}
    for section in ('personal', 'contact', 'education', 'family', 'financial'):
        merged_section = {}
        _merge_employee_section(merged_section, profile_data.get(section))
        _merge_employee_section(merged_section, source_payload.get(section))
        if merged_section:
            employee_payload[section] = merged_section

    employment = _get_employee_employment_data(source_payload)
    if employment:
        employee_payload['employment'] = dict(employment)

    if user_id:
        employee_payload['userId'] = user_id

    if role == 'teacher' and role_code:
        employee_payload['teacherId'] = role_code
    elif role == 'hr' and role_code:
        employee_payload['hrId'] = role_code

    if profile_image_url:
        personal = dict(employee_payload.get('personal') or {})
        personal['profileImageName'] = profile_image_url
        employee_payload['personal'] = personal

    return normalize_clean_employee_document(employee_payload, emp_id, user_id)


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


def _pick_first_non_empty(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                return value.strip()
            continue
        return value
    return ''


def _derive_employee_active_state(status_value, payload):
    if isinstance(payload.get('isActive'), bool):
        return payload.get('isActive')
    return 'terminated' not in str(status_value or '').strip().lower()


def _derive_employee_terminated_state(status_value, payload):
    if isinstance(payload.get('terminated'), bool):
        return payload.get('terminated')
    return 'terminated' in str(status_value or '').strip().lower()


def build_employee_summary(emp_id, employee_payload, linked_user=None):
    payload = employee_payload or {}
    profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}
    personal = payload.get('personal') if isinstance(payload.get('personal'), dict) else {}
    contact = payload.get('contact') if isinstance(payload.get('contact'), dict) else {}
    employment = _get_employee_employment_data(payload)
    job = employment or (payload.get('job') if isinstance(payload.get('job'), dict) else {})

    if not personal and isinstance(profile_data.get('personal'), dict):
        personal = profile_data.get('personal') or {}
    if not contact and isinstance(profile_data.get('contact'), dict):
        contact = profile_data.get('contact') or {}
    if not job:
        job = _get_employee_employment_data({'profileData': profile_data})

    linked_user = linked_user if isinstance(linked_user, dict) else {}
    linked_user_personal = linked_user.get('personal') if isinstance(linked_user.get('personal'), dict) else {}

    first_name = _pick_first_non_empty(personal.get('firstName'), payload.get('firstName'))
    middle_name = _pick_first_non_empty(personal.get('middleName'), payload.get('middleName'))
    last_name = _pick_first_non_empty(personal.get('lastName'), payload.get('lastName'))
    full_name = _pick_first_non_empty(
        payload.get('name'),
        payload.get('fullName'),
        ' '.join([part for part in [first_name, middle_name, last_name] if part]).strip(),
        'Employee',
    )

    email = _pick_first_non_empty(contact.get('email'), contact.get('altEmail'), payload.get('email'), linked_user.get('email'))
    alt_email = _pick_first_non_empty(contact.get('altEmail'), payload.get('altEmail'))
    phone_primary = _pick_first_non_empty(contact.get('phone1'), contact.get('phone'), payload.get('phone1'), payload.get('phone'), linked_user.get('phone'))
    phone_secondary = _pick_first_non_empty(contact.get('phone2'), payload.get('phone2'))
    profile_image = _pick_first_non_empty(
        payload.get('profileImage'),
        personal.get('profileImage'),
        personal.get('profileImageName'),
        linked_user.get('profileImage'),
        linked_user.get('photoURL'),
    )
    gender_raw = _pick_first_non_empty(
        payload.get('gender'),
        personal.get('gender'),
        linked_user.get('gender'),
        linked_user_personal.get('gender'),
    )
    gender = _normalize_gender(gender_raw) or (str(gender_raw).strip().lower() if gender_raw else '')
    birth_date = _pick_first_non_empty(payload.get('birthDate'), personal.get('dob'), personal.get('birthDate'))
    hire_date = _pick_first_non_empty(payload.get('hireDate'), job.get('hireDate'), job.get('startDate'), job.get('employmentStartDate'))
    contract_end = _pick_first_non_empty(payload.get('contractEnd'), job.get('contractEndDate'), job.get('contractEnd'))
    raw_status = _pick_first_non_empty(job.get('status'), payload.get('status'), '')
    terminated = _derive_employee_terminated_state(raw_status, payload)
    is_active = _derive_employee_active_state(raw_status, payload)
    if terminated:
        status = raw_status or 'Terminated'
        is_active = False
    elif is_active is False:
        status = raw_status or 'Inactive'
    else:
        status = raw_status or 'Active'
    employee_category = _pick_first_non_empty(job.get('employeeCategory'), job.get('category'), payload.get('employeeCategory'))
    position = _pick_first_non_empty(job.get('position'), payload.get('position'), payload.get('role'))
    department = _pick_first_non_empty(job.get('department'), payload.get('department'))

    teacher_id = _pick_first_non_empty(payload.get('teacherId'), profile_data.get('teacherId'))
    management_id = _pick_first_non_empty(payload.get('managementId'), profile_data.get('managementId'))
    finance_id = _pick_first_non_empty(payload.get('financeId'), profile_data.get('financeId'))
    hr_id = _pick_first_non_empty(payload.get('hrId'), profile_data.get('hrId'))

    return {
        'id': emp_id,
        'employeeId': emp_id,
        'userId': _get_linked_user_id(payload),
        'name': full_name,
        'fullName': full_name,
        'gender': gender,
        'birthDate': birth_date or '',
        'hireDate': hire_date or '',
        'contractEnd': contract_end or '',
        'department': department or '',
        'position': position or '',
        'role': employee_category or position or payload.get('role') or 'Staff',
        'employeeCategory': employee_category or '',
        'status': status or '',
        'isActive': is_active,
        'terminated': terminated,
        'deactivated': not terminated and is_active is False,
        'email': email or '',
        'altEmail': alt_email or '',
        'phone': phone_primary or '',
        'phone1': phone_primary or '',
        'phone2': phone_secondary or '',
        'profileImage': profile_image or '',
        'teacherId': teacher_id or '',
        'managementId': management_id or '',
        'financeId': finance_id or '',
        'hrId': hr_id or '',
        'presentToday': payload.get('presentToday'),
        'createdAt': payload.get('createdAt') or '',
        'personal': {
            'employeeId': emp_id,
            'firstName': first_name or '',
            'middleName': middle_name or '',
            'lastName': last_name or '',
            'dob': birth_date or '',
            'gender': gender or '',
            'profileImageName': profile_image or '',
        },
        'contact': {
            'email': email or '',
            'altEmail': alt_email or '',
            'phone1': phone_primary or '',
            'phone2': phone_secondary or '',
        },
        'job': {
            'employeeId': emp_id,
            'department': department or '',
            'position': position or '',
            'employeeCategory': employee_category or '',
            'category': employee_category or '',
            'hireDate': hire_date or '',
            'contractEndDate': contract_end or '',
            'status': status or '',
        },
        'employment': {
            'employeeId': emp_id,
            'department': department or '',
            'position': position or '',
            'employeeCategory': employee_category or '',
            'category': employee_category or '',
            'hireDate': hire_date or '',
            'contractEndDate': contract_end or '',
            'status': status or '',
        },
    }


def build_employee_credential_slip(emp_id, employee_payload, linked_user=None):
    payload = employee_payload if isinstance(employee_payload, dict) else {}
    linked_user = linked_user if isinstance(linked_user, dict) else {}
    summary = build_employee_summary(emp_id, payload, linked_user)

    login_username = _pick_first_non_empty(
        linked_user.get('username'),
        linked_user.get('loginUsername'),
        summary.get('teacherId'),
        summary.get('managementId'),
        summary.get('financeId'),
        summary.get('hrId'),
        summary.get('employeeId'),
    )
    password = _pick_first_non_empty(linked_user.get('password'), payload.get('password'))

    return {
        'name': summary.get('fullName') or summary.get('name') or 'Employee',
        'role': summary.get('role') or 'Staff',
        'employeeId': summary.get('employeeId') or emp_id,
        'loginUsername': login_username or '',
        'password': password or '',
        'userId': summary.get('userId') or '',
    }


def seed_employee_summaries(force=False):
    if not force:
        existing = employee_summaries_ref().get() or {}
        if isinstance(existing, dict) and existing:
            return existing

    employees_map = ref().get() or {}
    users_map = users_ref().get() or {}
    summary_map = {}

    if isinstance(employees_map, dict):
        for emp_id, payload in employees_map.items():
            payload = payload or {}
            linked_user = {}
            user_id = _get_linked_user_id(payload)
            if user_id and isinstance(users_map, dict):
                linked_user = users_map.get(str(user_id)) or users_map.get(user_id) or {}
            summary_map[emp_id] = build_employee_summary(emp_id, payload, linked_user)

    employee_summaries_ref().set(summary_map)
    return summary_map


def sync_employee_summary(emp_id, employee_payload=None, linked_user=None):
    payload = employee_payload
    if payload is None:
        payload = ref().child(emp_id).get()

    if not isinstance(payload, dict):
        employee_summaries_ref().child(emp_id).delete()
        return None

    user_payload = linked_user
    if user_payload is None:
        user_id = _get_linked_user_id(payload)
        if user_id:
            user_payload = users_ref().child(user_id).get() or {}
        else:
            user_payload = {}

    summary = build_employee_summary(emp_id, payload, user_payload)
    employee_summaries_ref().child(emp_id).set(summary)
    return summary


@app.route('/employees/summary', methods=['GET'])
def list_employee_summaries():
    status_filter = (request.args.get('status') or 'all').strip().lower()
    summary_map = employee_summaries_ref().get() or {}

    if not isinstance(summary_map, dict) or not summary_map:
        summary_map = seed_employee_summaries(force=False)

    if status_filter not in ('active', 'terminated'):
        return jsonify(summary_map or {}), 200

    filtered = {}
    for emp_id, payload in (summary_map.items() if isinstance(summary_map, dict) else []):
        item = payload or {}
        is_terminated = bool(item.get('terminated'))
        if status_filter == 'active' and is_terminated:
            continue
        if status_filter == 'terminated' and not is_terminated:
            continue
        filtered[emp_id] = item

    return jsonify(filtered), 200


@app.route('/employees/summary/stats', methods=['GET'])
def employee_summary_stats():
    summary_map = employee_summaries_ref().get() or {}
    if not isinstance(summary_map, dict) or not summary_map:
        summary_map = seed_employee_summaries(force=False)

    items = list((summary_map or {}).values()) if isinstance(summary_map, dict) else []
    active_count = len([item for item in items if not bool((item or {}).get('terminated'))])
    terminated_count = len([item for item in items if bool((item or {}).get('terminated'))])
    departments = sorted({str((item or {}).get('department') or '').strip() for item in items if str((item or {}).get('department') or '').strip()})

    return jsonify({
        'total': len(items),
        'active': active_count,
        'terminated': terminated_count,
        'departments': departments,
        'departmentCount': len(departments),
    }), 200


@app.route('/employees_with_gender', methods=['GET'])
def list_employees_with_gender():
    """Return employees with a computed `gender` field.

    Gender is resolved from, in order:
      - Employees node top-level 'gender'
      - Employees.personal.gender
      - Employees.profileData.personal.gender
            - Linked Users node 'gender' (if employee.userId present and requested)
    The returned payload mirrors the Employees node but guarantees a `gender` key
    with value 'male'|'female' or null when unknown.
    """
    try:
        resolve_linked_users = _coerce_bool_arg(request.args.get('resolveLinkedUsers'), default=False)
        raw = ref().get() or {}
        users_map = users_ref().get() or {} if resolve_linked_users else {}
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
                if not gender and resolve_linked_users:
                    user_id = _get_linked_user_id(payload)
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


@app.route('/users/lookup', methods=['GET'])
def lookup_user():
    username = (request.args.get('username') or '').strip()
    email = (request.args.get('email') or '').strip()

    if not username and not email:
        return jsonify({'error': 'username or email is required'}), 400

    try:
        if username:
            matched = users_ref().order_by_child('username').equal_to(username).limit_to_first(1).get() or {}
            if isinstance(matched, dict) and matched:
                uid, payload = next(iter(matched.items()))
                return jsonify({'id': uid, **(payload or {})}), 200

        if email:
            matched = users_ref().order_by_child('email').equal_to(email).limit_to_first(1).get() or {}
            if isinstance(matched, dict) and matched:
                uid, payload = next(iter(matched.items()))
                return jsonify({'id': uid, **(payload or {})}), 200

        return jsonify({'error': 'not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        existing_user = users_ref().child(user_id).get() or {}

        requested_password = str(payload.get('password') or '')
        if requested_password:
            old_password = str(payload.get('oldPassword') or '')
            stored_password = str(existing_user.get('password') or '')

            if not old_password:
                return jsonify({'ok': False, 'error': 'Current password is required to change the password.'}), 400
            if stored_password != old_password:
                return jsonify({'ok': False, 'error': 'Current password is incorrect.'}), 403

        # sanitize minimal fields
        allowed = {}
        for k, v in (payload.items() if isinstance(payload, dict) else []):
            # allow common profile fields (include password)
            if k in ('name', 'username', 'profileImage', 'email', 'phone', 'role', 'isActive', 'password'):
                allowed[k] = v
        if allowed:
            users_ref().child(user_id).update(allowed)
            updated_user = users_ref().child(user_id).get() or {}
            employee_id = updated_user.get('employeeId') if isinstance(updated_user, dict) else None
            if employee_id:
                sync_employee_summary(str(employee_id), linked_user=updated_user)
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
                updated_user = users_ref().child(user_id).get() or {}
                employee_id = updated_user.get('employeeId') if isinstance(updated_user, dict) else None
                if employee_id:
                    sync_employee_summary(str(employee_id), linked_user=updated_user)
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
            updated_user = users_ref().child(user_id).get() or {}
            employee_id = updated_user.get('employeeId') if isinstance(updated_user, dict) else None
            if employee_id:
                sync_employee_summary(str(employee_id), linked_user=updated_user)
            return jsonify({'profileImageUrl': url}), 200

        return jsonify({'error': 'No file or profileImage provided.'}), 400
    except Exception as e:
        # include a short trace in debug
        import traceback
        tb = traceback.format_exc()
        app.logger.error('upload_user_profile_image error: %s', tb)
        return jsonify({'error': str(e), 'trace': tb}), 500


@app.route('/departments', methods=['GET'])
def list_departments():
    try:
        raw = departments_ref().get() or {}
        items = []
        if isinstance(raw, dict):
            for department_id, payload in raw.items():
                item = payload or {}
                items.append({
                    'id': department_id,
                    'name': item.get('name') or department_id,
                    'description': item.get('description') or '',
                    'status': item.get('status') or 'active',
                })
        items.sort(key=lambda item: str(item.get('name') or '').lower())
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/departments', methods=['POST'])
def create_department():
    try:
        payload = request.get_json() or {}
        name = _normalize_reference_name(payload.get('name'))
        description = _normalize_reference_name(payload.get('description'))
        status = _normalize_department_status(payload.get('status'))

        if not name:
            return jsonify({'error': 'Department name is required.'}), 400

        raw = departments_ref().get() or {}
        raw = raw if isinstance(raw, dict) else {}

        for department_id, department_payload in raw.items():
            existing_name = _normalize_reference_name((department_payload or {}).get('name'))
            if existing_name.lower() == name.lower():
                return jsonify({
                    'error': 'Department already exists.',
                    'id': department_id,
                    'name': existing_name or name,
                }), 409

        department_id = _build_reference_key('DEP', name, raw.keys())
        department_payload = {
            'name': name,
            'description': description,
            'status': status,
        }
        departments_ref().child(department_id).set(department_payload)
        return jsonify({
            'id': department_id,
            **department_payload,
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/positions', methods=['GET'])
def list_positions():
    try:
        raw = positions_ref().get() or {}
        items = []
        if isinstance(raw, dict):
            for position_id, payload in raw.items():
                item = payload or {}
                items.append({
                    'id': position_id,
                    'name': item.get('name') or position_id,
                    'departmentId': item.get('departmentId') or '',
                })
        items.sort(key=lambda item: str(item.get('name') or '').lower())
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/positions', methods=['POST'])
def create_position():
    try:
        payload = request.get_json() or {}
        name = _normalize_reference_name(payload.get('name'))
        department_id = str(payload.get('departmentId') or '').strip()

        if not name:
            return jsonify({'error': 'Position name is required.'}), 400
        if not department_id:
            return jsonify({'error': 'Department is required for a position.'}), 400

        department_payload = departments_ref().child(department_id).get() or {}
        if not isinstance(department_payload, dict) or not department_payload:
            return jsonify({'error': 'Selected department does not exist.'}), 404

        raw = positions_ref().get() or {}
        raw = raw if isinstance(raw, dict) else {}

        for position_id, position_payload in raw.items():
            current_payload = position_payload or {}
            existing_name = _normalize_reference_name(current_payload.get('name'))
            existing_department_id = str(current_payload.get('departmentId') or '').strip()
            if existing_department_id == department_id and existing_name.lower() == name.lower():
                return jsonify({
                    'error': 'Position already exists in this department.',
                    'id': position_id,
                    'name': existing_name or name,
                    'departmentId': department_id,
                }), 409

        position_id = _build_reference_key('POS', name, raw.keys())
        position_payload = {
            'name': name,
            'departmentId': department_id,
        }
        positions_ref().child(position_id).set(position_payload)
        return jsonify({
            'id': position_id,
            **position_payload,
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/employees', methods=['POST'])
def create_employee():
    payload = request.get_json() or {}
    payload = normalize_clean_employee_document(payload, payload.get('employeeId') or payload.get('id'), payload.get('userId'))
    node = ref().push(payload)
    sync_employee_summary(node.key, payload)
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
        'profileImage': payload.get('profileImage') or (payload.get('personal') or {}).get('profileImageName') or '',
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender'),
        'teacherId': teacher_code  # ensure role id is present
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    emp_key = emp_code  # Employees node key is employee id
    employee_payload = build_registration_employee_payload(
        payload,
        emp_id=emp_key,
        user_id=user_id,
        role='teacher',
        role_code=teacher_code,
        profile_image_url=user_payload.get('profileImage') or '',
    )
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)
    sync_employee_summary(emp_key, employee_payload, user_payload)

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


@app.route('/register-school_admins', methods=['POST'])
@app.route('/register-management', methods=['POST'])
def register_school_admin():
    payload = request.get_json() or {}

    # generate formatted codes
    emp_code = generate_employee_code()
    school_admin_code = generate_school_admin_code()

    # Create user (username will be updated to school_admin_code)
    user_payload = {
        'username': school_admin_code,  # username is always the role id
        'name': payload.get('name'),
        'password': payload.get('password'),
        'role': SCHOOL_ADMIN_ROLE,
        'isActive': payload.get('isActive', True),
        'profileImage': payload.get('profileImage') or (payload.get('personal') or {}).get('profileImageName') or '',
        'email': payload.get('email') or (payload.get('contact') or {}).get('email'),
        'phone': (payload.get('contact') or {}).get('phone') or (payload.get('contact') or {}).get('phone1') or (payload.get('contact') or {}).get('phone2'),
        'gender': (payload.get('personal') or {}).get('gender') or payload.get('gender'),
        'schoolAdminId': school_admin_code,
    }
    user_node = users_ref().push(user_payload)
    user_id = user_node.key

    emp_key = emp_code  # Employees node key is employee id
    employee_payload = build_registration_employee_payload(
        payload,
        emp_id=emp_key,
        user_id=user_id,
        role='management',
        role_code=management_code,
        profile_image_url=user_payload.get('profileImage') or '',
    )
    # persist employee using code-based key
    employees_ref().child(emp_key).set(employee_payload)
    sync_employee_summary(emp_key, employee_payload, user_payload)

    # create school admin record now that employee exists; use role id as key for School_Admins
    school_admin_payload = {
        'userId': user_id,
        'employeeId': emp_key,  # employeeId is EMP_xxx
        'status': payload.get('status', 'active'),
        'profileImage': payload.get('profileImage', ''),
        'schoolAdminId': school_admin_code,
    }
    school_admins_ref().child(school_admin_code).set(school_admin_payload)

    # update user to use school admin code as username and record employeeId (use code-based key)
    users_ref().child(user_id).update({
        'schoolAdminId': school_admin_code,
        'employeeId': emp_key,
        'username': school_admin_code,
        # store the school's short name instead of the internal school code
        'schoolCode': get_school_shortname()
    })

    return jsonify({'userId': user_id, 'schoolAdminId': school_admin_code, 'employeeId': emp_key}), 201



# Deprecated: Use upload_profile_image_to_storage instead for profile images
def _file_to_dataurl(fstorage):
    if not fstorage:
        return ""
    data = fstorage.read()
    import base64
    b64 = base64.b64encode(data).decode('utf-8')
    return f"data:{fstorage.mimetype};base64,{b64}"


def _normalize_post_target_role(value):
    allowed_roles = {'all', 'teacher', SCHOOL_ADMIN_ROLE, 'finance', 'hr'}
    normalized = _normalize_role(value or 'all')
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
            str(payload.get('schoolAdminId') or ''),
            str(payload.get('managementId') or ''),
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
        media_file = request.files.get('media')

        def pick(key, default=''):
            if form.get(key) is not None:
                return form.get(key)
            if body.get(key) is not None:
                return body.get(key)
            return default

        message = (pick('message', '') or '').strip()
        hr_id = pick('hrId', '') or pick('adminId', '') or pick('ownerId', '') or ''
        admin_name = pick('adminName', '') or ''
        admin_profile = pick('adminProfile', '') or ''
        user_id = pick('userId', '') or ''
        target_role = (pick('targetRole', 'all') or 'all').strip().lower()

        if not hr_id and not user_id:
            return jsonify({'success': False, 'message': 'HR session expired'}), 400

        owner_key = hr_id or user_id
        post_url = ''
        media_type = ''

        if media_file:
            post_url = upload_post_media_to_storage(media_file, owner_key)
            media_type = media_file.mimetype or ''
        else:
            raw_post_url = pick('postUrl', '') or ''
            if raw_post_url and not str(raw_post_url).startswith('data:'):
                post_url = raw_post_url

        if not message and not post_url:
            return jsonify({'success': False, 'message': 'Post content is required'}), 400

        post_obj = {
            'postId': '',
            'hrId': hr_id,
            'adminId': hr_id,
            'userId': user_id,
            'adminName': admin_name or 'HR Office',
            'adminProfile': admin_profile,
            'postUrl': post_url,
            'mediaType': media_type,
            'message': message,
            'targetRole': target_role,
            'likeCount': 0,
            'likes': {},
            'seenBy': {owner_key: True} if owner_key else {},
            'time': datetime.utcnow().isoformat()
        }

        new_post_ref = posts_ref().push(post_obj)
        post_id = new_post_ref.key

        if not post_id:
            raise RuntimeError('Failed to generate post id.')

        post_obj['postId'] = post_id
        new_post_ref.update({'postId': post_id})

        return jsonify({'success': True, 'message': 'Post created successfully', 'post': post_obj}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/update_post/<post_id>', methods=['PATCH'])
def update_post(post_id):
    try:
        body = request.get_json(silent=True) or {}
        form = request.form.to_dict() if request.form else {}
        media_file = request.files.get('media')

        def pick(key, default=''):
            if form.get(key) is not None:
                return form.get(key)
            if body.get(key) is not None:
                return body.get(key)
            if request.args.get(key) is not None:
                return request.args.get(key)
            return default

        requester_id = str(
            pick('adminId', '')
            or pick('hrId', '')
            or pick('userId', '')
            or pick('ownerId', '')
            or ''
        ).strip()

        if not requester_id:
            return jsonify({'success': False, 'message': 'adminId is required'}), 400

        post_ref = posts_ref().child(str(post_id))
        post_data = post_ref.get() or {}

        if not post_data:
            return jsonify({'success': False, 'message': 'Post not found'}), 404

        owner_candidates = {
            str(post_data.get('adminId') or '').strip(),
            str(post_data.get('hrId') or '').strip(),
            str(post_data.get('userId') or '').strip(),
            str(post_data.get('ownerId') or '').strip(),
        }
        owner_candidates.discard('')

        if requester_id not in owner_candidates:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403

        message = (pick('message', post_data.get('message', '')) or '').strip()
        target_role = (pick('targetRole', post_data.get('targetRole', 'all')) or 'all').strip().lower()
        admin_name = (pick('adminName', post_data.get('adminName', '')) or '').strip() or post_data.get('adminName') or 'HR Office'
        admin_profile = pick('adminProfile', post_data.get('adminProfile', '')) or ''
        remove_media = str(pick('removeMedia', '') or '').strip().lower() in {'1', 'true', 'yes', 'on'}

        post_url = str(post_data.get('postUrl') or '').strip()
        media_type = str(post_data.get('mediaType') or '').strip()

        if media_file:
            post_url = upload_post_media_to_storage(media_file, requester_id)
            media_type = media_file.mimetype or ''
        elif remove_media:
            post_url = ''
            media_type = ''
        else:
            incoming_post_url = pick('postUrl', None)
            incoming_media_type = pick('mediaType', None)
            if incoming_post_url is not None and not str(incoming_post_url).startswith('data:'):
                post_url = str(incoming_post_url or '').strip()
            if incoming_media_type is not None:
                media_type = str(incoming_media_type or '').strip()

        if not message and not post_url:
            return jsonify({'success': False, 'message': 'Post content is required'}), 400

        updated_post = {
            **post_data,
            'postId': str(post_id),
            'message': message,
            'targetRole': target_role or 'all',
            'adminName': admin_name,
            'adminProfile': admin_profile,
            'postUrl': post_url,
            'mediaType': media_type,
            'editedAt': datetime.utcnow().isoformat(),
        }

        post_ref.update(updated_post)
        return jsonify({'success': True, 'message': 'Post updated successfully', 'post': updated_post}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def _coerce_bool_value(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _normalize_calendar_event_payload(payload, existing_event=None):
    source = payload if isinstance(payload, dict) else {}
    current = existing_event if isinstance(existing_event, dict) else {}

    category = str(
        source.get('category')
        or source.get('type')
        or current.get('category')
        or current.get('type')
        or 'no-class'
    ).strip().lower()
    if category != 'academic':
        category = 'no-class'

    title = str(source.get('title') or current.get('title') or ('Academic' if category == 'academic' else 'No class')).strip()
    notes = str(source.get('notes') or current.get('notes') or '').strip()
    sub_type = str(source.get('subType') or current.get('subType') or 'general').strip() or 'general'
    gregorian_date = str(source.get('gregorianDate') or current.get('gregorianDate') or '').strip()

    if not gregorian_date:
        raise ValueError('gregorianDate is required')

    try:
        datetime.strptime(gregorian_date, '%Y-%m-%d')
    except Exception as exc:
        raise ValueError('gregorianDate must be in YYYY-MM-DD format') from exc

    ethiopian_date_source = source.get('ethiopianDate')
    if not isinstance(ethiopian_date_source, dict):
        ethiopian_date_source = current.get('ethiopianDate') if isinstance(current.get('ethiopianDate'), dict) else None

    ethiopian_date = None
    if isinstance(ethiopian_date_source, dict):
        year = ethiopian_date_source.get('year')
        month = ethiopian_date_source.get('month')
        day = ethiopian_date_source.get('day')
        if year not in (None, '') and month not in (None, '') and day not in (None, ''):
            try:
                ethiopian_date = {
                    'year': int(year),
                    'month': int(month),
                    'day': int(day),
                }
            except Exception:
                ethiopian_date = None

    if 'showInUpcomingDeadlines' in source:
        show_in_upcoming = _coerce_bool_value(source.get('showInUpcomingDeadlines'), default=False)
    else:
        show_in_upcoming = _coerce_bool_value(current.get('showInUpcomingDeadlines'), default=(category == 'academic'))

    return {
        'title': title,
        'type': 'academic' if category == 'academic' else 'no-class',
        'category': category,
        'subType': sub_type,
        'notes': notes,
        'gregorianDate': gregorian_date,
        'ethiopianDate': ethiopian_date,
        'showInUpcomingDeadlines': show_in_upcoming,
    }


@app.route('/api/calendar_events', methods=['GET'])
def get_calendar_events():
    try:
        show_deadlines_only = _coerce_bool_arg(request.args.get('deadlinesOnly'), default=False)
        upcoming_only = _coerce_bool_arg(request.args.get('upcoming'), default=False)
        horizon_days = _coerce_non_negative_int(request.args.get('days'), default=None, max_value=365)
        today = datetime.utcnow().date()

        events_query = None
        if upcoming_only:
            events_query = calendar_events_ref().order_by_child('gregorianDate').start_at(today.isoformat())
            if horizon_days is not None:
                horizon_end = (today + timedelta(days=horizon_days)).isoformat()
                events_query = events_query.end_at(horizon_end)

        try:
            raw_events = events_query.get() if events_query is not None else calendar_events_ref().get() or {}
        except Exception:
            raw_events = calendar_events_ref().get() or {}

        events = []
        if isinstance(raw_events, dict):
            for event_id, value in raw_events.items():
                event_item = value or {}
                event_item['id'] = event_item.get('id') or event_id
                events.append(event_item)

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


@app.route('/api/calendar_events', methods=['POST'])
def create_calendar_event():
    try:
        body = request.get_json(silent=True) or {}
        requester_id = str(
            body.get('userId')
            or body.get('adminId')
            or body.get('createdBy')
            or ''
        ).strip()

        if not requester_id:
            return jsonify({'success': False, 'message': 'userId is required'}), 400

        event_payload = _normalize_calendar_event_payload(body)
        event_payload.update({
            'id': '',
            'createdAt': datetime.utcnow().isoformat(),
            'createdBy': requester_id,
        })

        event_ref = calendar_events_ref().push(event_payload)
        event_id = event_ref.key

        if not event_id:
            raise RuntimeError('Failed to generate event id.')

        event_payload['id'] = event_id
        event_ref.update({'id': event_id})
        return jsonify({'success': True, 'event': event_payload}), 201
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/calendar_events/<event_id>', methods=['PATCH'])
def update_calendar_event(event_id):
    try:
        body = request.get_json(silent=True) or {}
        requester_id = str(
            body.get('userId')
            or body.get('adminId')
            or body.get('createdBy')
            or ''
        ).strip()

        if not requester_id:
            return jsonify({'success': False, 'message': 'userId is required'}), 400

        event_ref = calendar_events_ref().child(str(event_id))
        existing_event = event_ref.get() or {}

        if not existing_event:
            return jsonify({'success': False, 'message': 'Calendar event not found'}), 404

        updated_payload = _normalize_calendar_event_payload(body, existing_event)
        updated_event = {
            **existing_event,
            **updated_payload,
            'id': str(event_id),
            'createdAt': existing_event.get('createdAt') or datetime.utcnow().isoformat(),
            'createdBy': existing_event.get('createdBy') or requester_id,
            'updatedAt': datetime.utcnow().isoformat(),
        }

        event_ref.set(updated_event)
        return jsonify({'success': True, 'event': updated_event}), 200
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/calendar_events/<event_id>', methods=['DELETE'])
def delete_calendar_event(event_id):
    try:
        body = request.get_json(silent=True) or {}
        requester_id = str(
            request.args.get('userId')
            or body.get('userId')
            or body.get('adminId')
            or ''
        ).strip()

        if not requester_id:
            return jsonify({'success': False, 'message': 'userId is required'}), 400

        event_ref = calendar_events_ref().child(str(event_id))
        existing_event = event_ref.get() or {}

        if not existing_event:
            return jsonify({'success': False, 'message': 'Calendar event not found'}), 404

        event_ref.delete()
        return jsonify({'success': True, 'message': 'Calendar event deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/get_posts', methods=['GET'])
def get_posts():
    """Return posts as an array. Each post will include an `id` field.

    The frontend expects an array; return sorted posts (newest first) when possible.
    """
    try:
        limit = _coerce_non_negative_int(request.args.get('limit'), default=None, max_value=100)

        try:
            if limit:
                raw = posts_ref().order_by_child('time').limit_to_last(limit).get() or {}
            else:
                raw = posts_ref().get() or {}
        except Exception:
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


@app.route('/api/like_post', methods=['POST'])
def like_post():
    try:
        body = request.get_json(silent=True) or {}
        form = request.form.to_dict() if request.form else {}

        def pick(key, default=''):
            if form.get(key) is not None:
                return form.get(key)
            if body.get(key) is not None:
                return body.get(key)
            if request.args.get(key) is not None:
                return request.args.get(key)
            return default

        post_id = str(pick('postId', '') or '').strip()
        actor_id = str(
            pick('userId', '')
            or pick('adminId', '')
            or pick('hrId', '')
            or pick('ownerId', '')
            or ''
        ).strip()

        if not post_id:
            return jsonify({'success': False, 'message': 'postId is required'}), 400
        if not actor_id:
            return jsonify({'success': False, 'message': 'user identifier is required'}), 400

        post_ref = posts_ref().child(post_id)
        post_data = post_ref.get() or {}

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


@app.route('/api/delete_post/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        requester_id = str(
            request.args.get('adminId')
            or request.args.get('hrId')
            or request.args.get('userId')
            or ''
        ).strip()

        if not requester_id:
            body = request.get_json(silent=True) or {}
            requester_id = str(
                body.get('adminId')
                or body.get('hrId')
                or body.get('userId')
                or ''
            ).strip()

        if not requester_id:
            return jsonify({'success': False, 'message': 'adminId is required'}), 400

        post_ref = posts_ref().child(str(post_id))
        post_data = post_ref.get() or {}

        if not post_data:
            return jsonify({'success': False, 'message': 'Post not found'}), 404

        owner_candidates = {
            str(post_data.get('adminId') or '').strip(),
            str(post_data.get('hrId') or '').strip(),
            str(post_data.get('userId') or '').strip(),
            str(post_data.get('ownerId') or '').strip(),
        }
        owner_candidates.discard('')

        if requester_id not in owner_candidates:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403

        post_ref.delete()
        return jsonify({'success': True, 'message': 'Post deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/register/<role>', methods=['POST'])
def register_role(role):
    import time
    role = _normalize_role(role)
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
    school_admin_code = generate_school_admin_code() if role == SCHOOL_ADMIN_ROLE else None
    finance_code = generate_finance_code() if role == 'finance' else None
    hr_code = generate_hr_code() if role == 'hr' else None
    role_code = (
        teacher_code if role == 'teacher' else
        school_admin_code if role == SCHOOL_ADMIN_ROLE else
        finance_code if role == 'finance' else
        hr_code if role == 'hr' else
        emp_code
    )
    role_folder = (
        'Teacher' if role == 'teacher' else
        SCHOOL_ADMINS_NODE if role == SCHOOL_ADMIN_ROLE else
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
        employee_payload = build_registration_employee_payload(
            profile_json,
            emp_id=emp_code,
            profile_image_url=profile_image_url,
        )
        emp_key = emp_code
        employees_ref().child(emp_key).set(employee_payload)
        sync_employee_summary(emp_key, employee_payload)
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
        'phone': form.get('phone') or profile_json.get('contact', {}).get('phone') or profile_json.get('contact', {}).get('phone1') or profile_json.get('contact', {}).get('phone2', ''),
        'isActive': True,
        'profileImage': profile_image_url,
    }
    # Add the correct role id field
    if role == 'teacher':
        user_payload['teacherId'] = role_code
    elif role == SCHOOL_ADMIN_ROLE:
        user_payload['schoolAdminId'] = role_code
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

    employee_payload = build_registration_employee_payload(
        profile_json,
        emp_id=emp_code,
        user_id=user_id,
        role=role,
        role_code=role_code,
        profile_image_url=profile_image_url,
    )
    # persist employee under formatted key
    # Employees node key is always employee id
    emp_key = emp_code
    employees_ref().child(emp_key).set(employee_payload)
    sync_employee_summary(emp_key, employee_payload, user_payload)

    # create role node with role id as key, and employeeId as EMP_xxx
    role_payload = {'userId': user_id, 'employeeId': emp_key, 'status': form.get('status', 'active')}
    if role == 'teacher':
        teachers_ref().child(teacher_code).set(role_payload)
    elif role == 'finance':
        finances_ref().child(finance_code).set(role_payload)
    elif role == SCHOOL_ADMIN_ROLE:
        school_admins_ref().child(school_admin_code).set({
            **role_payload,
            'schoolAdminId': school_admin_code,
        })
    elif role == 'hr':
        hrs_ref().child(hr_code).set(role_payload)
    else:
        pass

    return jsonify({
        'success': True,
        'message': 'Registered',
        'userId': user_id,
        'roleId': role_code,
        'loginUsername': role_code,
        'employeeId': emp_key,
        'profileImageUrl': profile_image_url,
    }), 201


@app.route('/employees/<emp_id>', methods=['GET'])
def get_employee(emp_id):
    data = ref().child(emp_id).get()
    if data is None:
        return jsonify({'error': 'not found'}), 404
    if not isinstance(data, dict):
        return jsonify(data)

    payload = dict(data)
    linked_user_id = _get_linked_user_id(payload)
    linked_user = users_ref().child(linked_user_id).get() if linked_user_id else {}
    if not isinstance(linked_user, dict):
        linked_user = {}

    credential_slip = build_employee_credential_slip(emp_id, payload, linked_user)
    payload['credentialSlip'] = credential_slip
    payload['loginUsername'] = credential_slip.get('loginUsername') or ''
    payload['password'] = credential_slip.get('password') or ''
    return jsonify(payload)


@app.route('/employees/<emp_id>', methods=['PUT'])
def update_employee(emp_id):
    employee_ref = ref().child(emp_id)
    existing = employee_ref.get() or {}
    payload = request.get_json() or {}
    payload = normalize_clean_employee_document(payload, emp_id, payload.get('userId'))

    employee_ref = ref().child(emp_id)
    employee_ref.update(payload)
    for key in LEGACY_EMPLOYEE_FIELDS:
        employee_ref.child(key).delete()

    nested_gender = None
    if isinstance(payload.get('personal'), dict):
        nested_gender = payload.get('personal', {}).get('gender')
    if nested_gender is not None:
        employee_ref.child('gender').delete()
    sync_employee_summary(emp_id)
    return jsonify({'ok': True})


@app.route('/employees/<emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    return jsonify({
        'ok': False,
        'error': 'hard delete disabled',
        'message': 'Use POST /employees/<emp_id>/terminate to archive the employee record and deactivate linked access.',
    }), 405


@app.route('/employees/<emp_id>/terminate', methods=['POST'])
def terminate_employee(emp_id):
    employee_ref = ref().child(emp_id)
    employee_data = employee_ref.get()

    if employee_data is None:
        return jsonify({'ok': False, 'error': 'employee not found'}), 404

    if not isinstance(employee_data, dict):
        employee_data = {}

    payload = request.get_json(silent=True) or {}
    terminated_at = datetime.utcnow().isoformat() + 'Z'
    hrid = None
    try:
        hrid = payload.get('hrId') or payload.get('hrID') or payload.get('adminId') or payload.get('adminID')
    except Exception:
        hrid = None

    reason = (payload.get('terminationReason') or payload.get('reason') or '').strip()
    note = (payload.get('terminationNote') or payload.get('note') or '').strip()
    last_working_date = (payload.get('lastWorkingDate') or '').strip()

    linked_user_id = _get_linked_user_id(employee_data)

    gender = None
    personal = employee_data.get('personal') or (employee_data.get('profileData') or {}).get('personal') or {}
    gender = personal.get('gender') or employee_data.get('gender')

    job_data = _get_employee_employment_data(employee_data)
    role_value = str(job_data.get('employeeCategory') or job_data.get('category') or job_data.get('position') or employee_data.get('role') or '').strip().lower()
    is_teacher_employee = bool(employee_data.get('teacherId')) or 'teacher' in role_value
    is_terminated = _derive_employee_terminated_state(job_data.get('status') or employee_data.get('status'), employee_data)
    is_active_employee = _derive_employee_active_state(job_data.get('status') or employee_data.get('status'), employee_data)

    if is_teacher_employee and is_active_employee and not is_terminated:
        return jsonify({
            'ok': False,
            'error': 'Academic administration must deactivate this teacher before HR can terminate the employee record.',
            'requiresAcademicDeactivation': True,
            'employeeId': emp_id,
        }), 409

    termination_payload = {
        'reason': reason,
        'note': note,
        'lastWorkingDate': last_working_date,
        'terminatedAt': terminated_at,
        'terminatedBy': hrid or '',
        'accessRevokedAt': terminated_at,
    }

    terminated_by_employee_id, terminated_by_name = _resolve_termination_actor_details(hrid)
    employee_name = _pick_first_non_empty(
        employee_data.get('name'),
        employee_data.get('fullName'),
        ' '.join([part for part in [personal.get('firstName'), personal.get('middleName'), personal.get('lastName')] if part]).strip(),
        emp_id,
    )
    termination_record_id = generate_termination_code()

    employee_terminations_ref().child(termination_record_id).set({
        'terminationId': termination_record_id,
        'employeeId': emp_id,
        'userId': linked_user_id or '',
        'employeeName': employee_name,
        'position': job_data.get('position') or employee_data.get('position') or employee_data.get('role') or '',
        'department': _resolve_department_name(job_data.get('department') or employee_data.get('department') or ''),
        'date': last_working_date or terminated_at[:10],
        'reason': reason,
        'note': note,
        'terminatedBy': terminated_by_employee_id or hrid or '',
        'terminatedByName': terminated_by_name or '',
        'createdAt': terminated_at,
    })
    termination_meta = sync_employee_termination_meta()

    employee_ref.update({
        'terminatedAt': terminated_at,
        'terminatedBy': hrid or '',
        'terminated': True,
        'termination': termination_payload,
    })
    employee_ref.child('status').delete()
    employee_ref.child('isActive').delete()

    if isinstance(employee_data.get('job'), dict):
        employee_ref.child('job').update({
            'status': 'Terminated',
            'lastWorkingDate': last_working_date,
        })
        employee_ref.child('job').child('isActive').delete()
    if isinstance(employee_data.get('employment'), dict):
        employee_ref.child('employment').update({
            'status': 'Terminated',
            'lastWorkingDate': last_working_date,
        })
        employee_ref.child('employment').child('isActive').delete()
    if isinstance((employee_data.get('profileData') or {}).get('job'), dict):
        employee_ref.child('profileData').child('job').update({
            'status': 'Terminated',
            'lastWorkingDate': last_working_date,
        })
        employee_ref.child('profileData').child('job').child('isActive').delete()
    if isinstance((employee_data.get('profileData') or {}).get('employment'), dict):
        employee_ref.child('profileData').child('employment').update({
            'status': 'Terminated',
            'lastWorkingDate': last_working_date,
        })
        employee_ref.child('profileData').child('employment').child('isActive').delete()

    updated_employee_payload = dict(employee_data)
    updated_employee_payload['terminatedAt'] = terminated_at
    updated_employee_payload['terminatedBy'] = hrid or ''
    updated_employee_payload['terminated'] = True
    updated_employee_payload['termination'] = termination_payload
    updated_employee_payload.pop('status', None)
    updated_employee_payload.pop('isActive', None)

    if isinstance(updated_employee_payload.get('job'), dict):
        updated_job = dict(updated_employee_payload.get('job') or {})
        updated_job['status'] = 'Terminated'
        updated_job['lastWorkingDate'] = last_working_date
        updated_job.pop('isActive', None)
        updated_employee_payload['job'] = updated_job

    if isinstance(updated_employee_payload.get('employment'), dict):
        updated_employment = dict(updated_employee_payload.get('employment') or {})
        updated_employment['status'] = 'Terminated'
        updated_employment['lastWorkingDate'] = last_working_date
        updated_employment.pop('isActive', None)
        updated_employee_payload['employment'] = updated_employment

    if isinstance(updated_employee_payload.get('profileData'), dict):
        updated_profile_data = dict(updated_employee_payload.get('profileData') or {})
        if isinstance(updated_profile_data.get('job'), dict):
            updated_profile_job = dict(updated_profile_data.get('job') or {})
            updated_profile_job['status'] = 'Terminated'
            updated_profile_job['lastWorkingDate'] = last_working_date
            updated_profile_job.pop('isActive', None)
            updated_profile_data['job'] = updated_profile_job
        if isinstance(updated_profile_data.get('employment'), dict):
            updated_profile_employment = dict(updated_profile_data.get('employment') or {})
            updated_profile_employment['status'] = 'Terminated'
            updated_profile_employment['lastWorkingDate'] = last_working_date
            updated_profile_employment.pop('isActive', None)
            updated_profile_data['employment'] = updated_profile_employment
        updated_employee_payload['profileData'] = updated_profile_data

    updated_user_ids = []
    updated_linked_user = None
    if linked_user_id:
        direct_user_payload = users_ref().child(linked_user_id).get() or {}
        if isinstance(direct_user_payload, dict):
            updated_linked_user = dict(direct_user_payload)
            updated_linked_user.update({
                'isActive': False,
                'status': 'inactive',
                'terminatedAt': terminated_at,
                'terminatedBy': hrid or '',
                'employeeId': emp_id,
            })
            users_ref().child(linked_user_id).update({
            'isActive': False,
            'status': 'inactive',
            'terminatedAt': terminated_at,
            'terminatedBy': hrid or '',
            'employeeId': emp_id,
        })
            updated_user_ids.append(str(linked_user_id))

    def _deactivate_role_node(role_ref_fn, role_id_key, employee_key):
        role_id = employee_data.get(role_id_key)
        updated_role_ids = []
        if role_id:
          role_ref_fn().child(str(role_id)).update({
              'status': 'inactive',
              'isActive': False,
              'terminatedAt': terminated_at,
              'terminatedBy': hrid or '',
              'employeeId': employee_key,
          })
          updated_role_ids.append(str(role_id))

        records = role_ref_fn().order_by_child('employeeId').equal_to(str(employee_key)).get() or {}
        if isinstance(records, dict):
            for node_id, node_payload in records.items():
                if not isinstance(node_payload, dict):
                    continue
                role_ref_fn().child(str(node_id)).update({
                    'status': 'inactive',
                    'isActive': False,
                    'terminatedAt': terminated_at,
                    'terminatedBy': hrid or '',
                    'employeeId': employee_key,
                })
                updated_role_ids.append(str(node_id))
        return sorted(set(updated_role_ids))

    deactivated_roles = {
        'teachers': _deactivate_role_node(teachers_ref, 'teacherId', emp_id),
        'management': _deactivate_role_node(managements_ref, 'managementId', emp_id),
        'finance': _deactivate_role_node(finances_ref, 'financeId', emp_id),
        'hr': _deactivate_role_node(hrs_ref, 'hrId', emp_id),
    }

    sync_employee_summary(emp_id, updated_employee_payload, updated_linked_user)

    return jsonify({
        'ok': True,
        'employeeId': emp_id,
        'deactivatedUsers': updated_user_ids,
        'deactivatedRoleNodes': deactivated_roles,
        'terminationMeta': termination_meta,
        'termination': termination_payload,
    }), 200


@app.route('/login', methods=['POST'])
def login():
    payload = request.get_json() or {}
    username = str(payload.get('username') or '').strip()
    password = str(payload.get('password') or '')
    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400

    school_code, uid, user = find_user_across_schools(username)
    if isinstance(user, dict):
        stored_password = str(user.get('password') or '')
        if str(user.get('username') or '').strip() == username and stored_password == password:
            school_short_code = _normalize_school_code(user.get('schoolCode')).upper()
            # successful login - return minimal user info
            safe = {
                'id': uid,
                'username': user.get('username'),
                'name': user.get('name'),
                'role': user.get('role'),
                'isActive': user.get('isActive', True),
                'email': user.get('email', ''),
                'profileImage': user.get('profileImage', ''),
                'schoolCode': school_code,
                'activeSchoolCode': school_code,
                'schoolShortCode': school_short_code,
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
    days = _coerce_non_negative_int(request.args.get('days'), default=None, max_value=365)

    if days is not None:
        start_date = (datetime.utcnow().date() - timedelta(days=max(days - 1, 0))).isoformat()
        data = employees_attendance_ref().order_by_key().start_at(start_date).end_at(_today_iso_date()).get() or {}
    else:
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

    employee_ref.update({
        'terminated': False,
    })
    employee_ref.child('status').delete()
    employee_ref.child('isActive').delete()
    employee_ref.child('terminatedAt').delete()
    employee_ref.child('terminatedBy').delete()
    employee_ref.child('termination').delete()
    archived_terminations = employee_terminations_ref().order_by_child('employeeId').equal_to(str(emp_id)).get() or {}
    if isinstance(archived_terminations, dict):
        for termination_id in archived_terminations.keys():
            employee_terminations_ref().child(str(termination_id)).delete()
    termination_meta = sync_employee_termination_meta()
    if isinstance(employee_data.get('job'), dict):
        employee_ref.child('job').update({
            'status': 'active',
        })
        employee_ref.child('job').child('isActive').delete()
        employee_ref.child('job').child('lastWorkingDate').delete()
    if isinstance(employee_data.get('employment'), dict):
        employee_ref.child('employment').update({
            'status': 'active',
        })
        employee_ref.child('employment').child('isActive').delete()
        employee_ref.child('employment').child('lastWorkingDate').delete()
    if isinstance((employee_data.get('profileData') or {}).get('job'), dict):
        employee_ref.child('profileData').child('job').update({
            'status': 'active',
        })
        employee_ref.child('profileData').child('job').child('isActive').delete()
        employee_ref.child('profileData').child('job').child('lastWorkingDate').delete()
    if isinstance((employee_data.get('profileData') or {}).get('employment'), dict):
        employee_ref.child('profileData').child('employment').update({
            'status': 'active',
        })
        employee_ref.child('profileData').child('employment').child('isActive').delete()
        employee_ref.child('profileData').child('employment').child('lastWorkingDate').delete()

    job = _get_employee_employment_data(employee_data)
    contact = employee_data.get('contact') or (employee_data.get('profileData') or {}).get('contact') or {}
    personal = employee_data.get('personal') or (employee_data.get('profileData') or {}).get('personal') or {}
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
    role_value = str(job.get('employeeCategory') or job.get('category') or job.get('position') or employee_data.get('role') or '').strip().lower()
    role_id = (
        employee_data.get('teacherId') or job.get('teacherId')
        or employee_data.get('managementId') or job.get('managementId')
        or employee_data.get('financeId') or job.get('financeId')
        or employee_data.get('hrId') or job.get('hrId')
        or None
    )
    if employee_data.get('teacherId') or job.get('teacherId') or 'teacher' in role_value:
        role = 'teacher'
    elif employee_data.get('managementId') or job.get('managementId') or any(token in role_value for token in ('management', 'director', 'principal', 'vice director')):
        role = 'management'
    elif employee_data.get('financeId') or job.get('financeId') or 'finance' in role_value or 'account' in role_value:
        role = 'finance'
    elif employee_data.get('hrId') or job.get('hrId') or role_value == 'hr' or 'human resource' in role_value:
        role = 'hr'
    if role == 'teacher' and not role_id:
        role_id = generate_teacher_code()
    elif role == 'management' and not role_id:
        role_id = generate_management_code()
    elif role == 'finance' and not role_id:
        role_id = generate_finance_code()
    elif role == 'hr' and not role_id:
        role_id = generate_hr_code()

    gender = personal.get('gender', '')
    if not gender:
        gender = employee_data.get('gender', '') or 'unknown'

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

    updated_employee_payload = dict(employee_data or {})
    updated_employee_payload['terminated'] = False
    updated_employee_payload.pop('status', None)
    updated_employee_payload.pop('isActive', None)
    updated_employee_payload.pop('terminatedAt', None)
    updated_employee_payload.pop('terminatedBy', None)
    updated_employee_payload.pop('termination', None)
    if activated_by:
        updated_employee_payload['activatedBy'] = activated_by

    if isinstance(updated_employee_payload.get('job'), dict):
        updated_job = dict(updated_employee_payload.get('job') or {})
        updated_job['status'] = 'active'
        updated_job.pop('isActive', None)
        updated_job.pop('lastWorkingDate', None)
        updated_employee_payload['job'] = updated_job

    if isinstance(updated_employee_payload.get('employment'), dict):
        updated_employment = dict(updated_employee_payload.get('employment') or {})
        updated_employment['status'] = 'active'
        updated_employment.pop('isActive', None)
        updated_employment.pop('lastWorkingDate', None)
        updated_employee_payload['employment'] = updated_employment

    if isinstance(updated_employee_payload.get('profileData'), dict):
        updated_profile_data = dict(updated_employee_payload.get('profileData') or {})
        if isinstance(updated_profile_data.get('job'), dict):
            updated_profile_job = dict(updated_profile_data.get('job') or {})
            updated_profile_job['status'] = 'active'
            updated_profile_job.pop('isActive', None)
            updated_profile_job.pop('lastWorkingDate', None)
            updated_profile_data['job'] = updated_profile_job
        if isinstance(updated_profile_data.get('employment'), dict):
            updated_profile_employment = dict(updated_profile_data.get('employment') or {})
            updated_profile_employment['status'] = 'active'
            updated_profile_employment.pop('isActive', None)
            updated_profile_employment.pop('lastWorkingDate', None)
            updated_profile_data['employment'] = updated_profile_employment
        updated_employee_payload['profileData'] = updated_profile_data

    base_user_payload = {
        'isActive': True,
        'status': 'active',
        'profileImage': profile_image,
        'email': email,
        'employeeId': emp_id,
        'phone': contact.get('phone') or contact.get('phone1') or contact.get('phone2') or '',
    }
    if name:
        base_user_payload['name'] = name
    if gender:
        base_user_payload['gender'] = gender
    if role:
        base_user_payload['role'] = role
    if role_id:
        base_user_payload['username'] = role_id

    linked_user_id = _get_linked_user_id(employee_data)
    updated_user_payload = None
    user_id = linked_user_id or None
    if linked_user_id:
        updated_user_payload = dict(base_user_payload)
        existing_user_payload = users_ref().child(linked_user_id).get() or {}
        if isinstance(existing_user_payload, dict):
            updated_user_payload = {**existing_user_payload, **base_user_payload}
        users_ref().child(linked_user_id).update(updated_user_payload)
        users_ref().child(linked_user_id).child('terminatedAt').delete()
        users_ref().child(linked_user_id).child('terminatedBy').delete()
    else:
        user_payload = {
            **base_user_payload,
            'username': base_user_payload.get('username') or emp_id,
            'password': employee_data.get('password', 'password123'),
            'role': base_user_payload.get('role') or '',
        }
        user_node = users_ref().push(user_payload)
        user_id = user_node.key
        updated_user_payload = dict(user_payload)

    if user_id:
        employee_ref.child('meta').child('userId').set(user_id)
        employee_ref.child('userId').set(user_id)
        updated_employee_payload['userId'] = user_id
        updated_meta_payload = dict(updated_employee_payload.get('meta') or {}) if isinstance(updated_employee_payload.get('meta'), dict) else {}
        updated_meta_payload['userId'] = user_id
        updated_employee_payload['meta'] = updated_meta_payload
        if isinstance(updated_employee_payload.get('profileData'), dict):
            updated_profile_data = dict(updated_employee_payload.get('profileData') or {})
            updated_profile_meta = dict(updated_profile_data.get('meta') or {}) if isinstance(updated_profile_data.get('meta'), dict) else {}
            updated_profile_meta['userId'] = user_id
            updated_profile_data['meta'] = updated_profile_meta
            updated_employee_payload['profileData'] = updated_profile_data

    role_node_id = None
    role_payload_base = {
        'userId': user_id,
        'employeeId': emp_id,
        'status': 'active',
        'isActive': True,
        'profileImage': profile_image,
    }

    def _reactivate_role_node(role_ref_fn, role_key, node_payload):
        updated_role_ids = []
        role_code = node_payload.get(role_key)
        if role_code:
            role_ref_fn().child(str(role_code)).update(node_payload)
            role_ref_fn().child(str(role_code)).child('terminatedAt').delete()
            role_ref_fn().child(str(role_code)).child('terminatedBy').delete()
            updated_role_ids.append(str(role_code))

        records = role_ref_fn().order_by_child('employeeId').equal_to(str(emp_id)).get() or {}
        if isinstance(records, dict):
            for node_id in records.keys():
                role_ref_fn().child(str(node_id)).update(node_payload)
                role_ref_fn().child(str(node_id)).child('terminatedAt').delete()
                role_ref_fn().child(str(node_id)).child('terminatedBy').delete()
                updated_role_ids.append(str(node_id))

        return sorted(set(updated_role_ids))

    reactivated_role_nodes = {}
    if role == 'teacher':
        teacher_payload = {**role_payload_base, 'teacherId': role_id}
        reactivated_role_nodes['teachers'] = _reactivate_role_node(teachers_ref, 'teacherId', teacher_payload)
        employee_ref.child('teacherId').set(role_id)
        users_ref().child(user_id).update({'teacherId': role_id, 'employeeId': emp_id, 'username': role_id})
        updated_employee_payload['teacherId'] = role_id
        role_node_id = role_id
    elif role == 'management':
        management_payload = {**role_payload_base, 'managementId': role_id}
        reactivated_role_nodes['management'] = _reactivate_role_node(managements_ref, 'managementId', management_payload)
        employee_ref.child('managementId').set(role_id)
        users_ref().child(user_id).update({'managementId': role_id, 'employeeId': emp_id, 'username': role_id})
        updated_employee_payload['managementId'] = role_id
        role_node_id = role_id
    elif role == 'finance':
        finance_payload = {**role_payload_base, 'financeId': role_id}
        reactivated_role_nodes['finance'] = _reactivate_role_node(finances_ref, 'financeId', finance_payload)
        employee_ref.child('financeId').set(role_id)
        users_ref().child(user_id).update({'financeId': role_id, 'employeeId': emp_id, 'username': role_id})
        updated_employee_payload['financeId'] = role_id
        role_node_id = role_id
    elif role == 'hr':
        hr_payload = {**role_payload_base, 'hrId': role_id}
        reactivated_role_nodes['hr'] = _reactivate_role_node(hrs_ref, 'hrId', hr_payload)
        employee_ref.child('hrId').set(role_id)
        users_ref().child(user_id).update({'hrId': role_id, 'employeeId': emp_id, 'username': role_id})
        updated_employee_payload['hrId'] = role_id
        role_node_id = role_id

    sync_employee_summary(emp_id, updated_employee_payload, updated_user_payload)

    return jsonify({'ok': True, 'employeeId': emp_id, 'userId': user_id, 'role': role, 'roleNodeId': role_node_id, 'reactivatedRoleNodes': reactivated_role_nodes, 'terminationMeta': termination_meta}), 200


@app.route('/employee-terminations', methods=['GET'])
def list_employee_terminations():
    try:
        raw = employee_terminations_ref().get() or {}
        summary_map = employee_summaries_ref().get() or {}
        items = []

        if isinstance(raw, dict):
            for termination_id, payload in raw.items():
                if str(termination_id) == '_meta':
                    continue
                item = payload or {}
                employee_id = str(item.get('employeeId') or '').strip()
                employee_summary = summary_map.get(employee_id) if isinstance(summary_map, dict) else {}
                employee_summary = employee_summary or {}

                items.append({
                    'id': termination_id,
                    'terminationId': item.get('terminationId') or termination_id,
                    'employeeId': employee_id,
                    'employeeName': item.get('employeeName') or employee_summary.get('fullName') or employee_summary.get('name') or 'Employee',
                    'position': item.get('position') or employee_summary.get('position') or employee_summary.get('role') or 'Staff',
                    'department': item.get('department') or _resolve_department_name(employee_summary.get('department') or ''),
                    'reason': item.get('reason') or 'Not recorded',
                    'note': item.get('note') or '',
                    'date': item.get('date') or '',
                    'createdAt': item.get('createdAt') or '',
                    'terminatedBy': item.get('terminatedBy') or '',
                    'terminatedByName': item.get('terminatedByName') or '',
                    'profileImage': item.get('profileImage') or employee_summary.get('profileImage') or '',
                })

        items.sort(key=lambda value: str(value.get('createdAt') or value.get('date') or ''), reverse=True)
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
    sync_employee_summary(emp_id)
    return jsonify({'profileImageUrl': url})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
