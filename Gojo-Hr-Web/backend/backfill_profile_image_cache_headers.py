import argparse
import json
import os
from urllib.parse import unquote, urlparse

import firebase_admin
from firebase_admin import credentials, db, storage

from firebase_config import FIREBASE_CREDENTIALS, FIREBASE_STORAGE_BUCKET, get_firebase_options, require_firebase_credentials


PLATFORM_ROOT = (os.getenv('PLATFORM_ROOT') or 'Platform1').strip() or 'Platform1'
SCHOOLS_ROOT = 'Schools'
DEFAULT_SCHOOL_CODE = (os.getenv('SCHOOL_CODE') or 'ET-ORO-ADA-GMI').strip() or 'ET-ORO-ADA-GMI'
PROFILE_IMAGE_PREFIX = 'HR/'
PROFILE_IMAGE_MARKER = '_profile'
TARGET_CACHE_CONTROL = 'public, max-age=31536000, immutable'
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff')


def ensure_firebase_app():
	if firebase_admin._apps:
		return firebase_admin.get_app()

	require_firebase_credentials()
	credential = credentials.Certificate(FIREBASE_CREDENTIALS)
	return firebase_admin.initialize_app(credential, get_firebase_options())


def parse_args():
	parser = argparse.ArgumentParser(
		description='Backfill immutable cache headers on existing HR profile images in Firebase Storage.',
	)
	parser.add_argument(
		'--school-code',
		default=DEFAULT_SCHOOL_CODE,
		help='Target one school code when collecting referenced profile image URLs.',
	)
	parser.add_argument(
		'--all-schools',
		action='store_true',
		help='Collect referenced profile images across every school under the platform root.',
	)
	parser.add_argument(
		'--dry-run',
		action='store_true',
		help='Report the objects that would be updated without patching storage metadata.',
	)
	parser.add_argument(
		'--limit',
		type=int,
		default=None,
		help='Maximum number of candidate profile images to inspect.',
	)
	parser.add_argument(
		'--verbose',
		action='store_true',
		help='Print every inspected object, including already-correct entries.',
	)
	return parser.parse_args()


def get_storage_bucket():
	try:
		return storage.bucket(FIREBASE_STORAGE_BUCKET)
	except Exception:
		return storage.bucket()


def normalize_school_code(value):
	return str(value or '').strip()


def platform_ref():
	return db.reference(PLATFORM_ROOT)


def schools_root_ref():
	return platform_ref().child(SCHOOLS_ROOT)


def school_ref(school_code):
	return schools_root_ref().child(normalize_school_code(school_code))


def employees_ref(school_code):
	return school_ref(school_code).child('Employees')


def employee_summaries_ref(school_code):
	return school_ref(school_code).child('EmployeeSummaries')


def target_school_codes(selected_school_code=None, all_schools=False):
	if all_schools:
		nodes = schools_root_ref().get() or {}
		if not isinstance(nodes, dict):
			return []
		return sorted(code for code in (normalize_school_code(value) for value in nodes.keys()) if code)

	school_code = normalize_school_code(selected_school_code or DEFAULT_SCHOOL_CODE)
	return [school_code] if school_code else []


def parse_storage_blob_name(url, bucket_name):
	parsed = urlparse(str(url or '').strip())
	path = parsed.path.lstrip('/')

	if not parsed.scheme or not parsed.netloc:
		return None

	if parsed.netloc.endswith('storage.googleapis.com'):
		prefix = f'{bucket_name}/'
		if path.startswith(prefix):
			return path[len(prefix):]

	if parsed.netloc.endswith('firebasestorage.googleapis.com'):
		marker = f'/b/{bucket_name}/o/'
		if marker in parsed.path:
			return unquote(parsed.path.split(marker, 1)[1])

	return None


def is_profile_image_blob(blob_name):
	normalized_name = str(blob_name or '').strip()
	if not normalized_name.startswith(PROFILE_IMAGE_PREFIX):
		return False

	relative_name = normalized_name[len(PROFILE_IMAGE_PREFIX):]
	if not relative_name or '/' in relative_name:
		return False

	if PROFILE_IMAGE_MARKER not in relative_name:
		return False

	return relative_name.lower().endswith(IMAGE_EXTENSIONS)


def extract_profile_image_urls(payload):
	if not isinstance(payload, dict):
		return []

	personal = payload.get('personal') if isinstance(payload.get('personal'), dict) else {}
	profile_data = payload.get('profileData') if isinstance(payload.get('profileData'), dict) else {}
	profile_personal = profile_data.get('personal') if isinstance(profile_data.get('personal'), dict) else {}

	return [
		payload.get('profileImage'),
		payload.get('profileImageUrl'),
		payload.get('photoURL'),
		payload.get('photo'),
		personal.get('profileImage'),
		personal.get('profileImageName'),
		profile_personal.get('profileImage'),
		profile_personal.get('profileImageName'),
	]


def collect_referenced_profile_blob_names(bucket_name, selected_school_code=None, all_schools=False):
	blob_names = set()

	for school_code in target_school_codes(selected_school_code, all_schools):
		for source_ref in (employees_ref(school_code), employee_summaries_ref(school_code)):
			node = source_ref.get() or {}
			if not isinstance(node, dict):
				continue

			for payload in node.values():
				for image_url in extract_profile_image_urls(payload):
					blob_name = parse_storage_blob_name(image_url, bucket_name)
					if blob_name and is_profile_image_blob(blob_name):
						blob_names.add(blob_name)

	return sorted(blob_names)


def backfill_profile_image_cache_headers(selected_school_code=None, all_schools=False, limit=None, dry_run=False, verbose=False):
	ensure_firebase_app()
	bucket = get_storage_bucket()
	inspected = 0
	updated = 0
	skipped = 0
	failed = 0
	results = []
	referenced_blob_names = collect_referenced_profile_blob_names(bucket.name, selected_school_code, all_schools)
	candidate_blob_names = referenced_blob_names

	if not candidate_blob_names:
		candidate_blob_names = [blob.name for blob in bucket.list_blobs(prefix=PROFILE_IMAGE_PREFIX) if is_profile_image_blob(blob.name)]

	for blob_name in candidate_blob_names:
		blob = bucket.blob(blob_name)

		if limit is not None and inspected >= max(0, int(limit)):
			break

		inspected += 1
		try:
			blob.reload()
			current_cache_control = str(blob.cache_control or '').strip()
			item = {
				'name': blob.name,
				'contentType': str(blob.content_type or ''),
				'cacheControl': current_cache_control,
			}

			if current_cache_control == TARGET_CACHE_CONTROL:
				skipped += 1
				item['status'] = 'already-configured'
				if verbose:
					results.append(item)
				continue

			if dry_run:
				updated += 1
				item['status'] = 'would-update'
				item['nextCacheControl'] = TARGET_CACHE_CONTROL
				results.append(item)
				continue

			blob.cache_control = TARGET_CACHE_CONTROL
			blob.patch()
			updated += 1
			item['status'] = 'updated'
			item['nextCacheControl'] = TARGET_CACHE_CONTROL
			results.append(item)
		except Exception as exc:
			failed += 1
			results.append({
				'name': str(blob.name or ''),
				'status': 'failed',
				'error': str(exc),
			})

	return {
		'schoolCodes': target_school_codes(selected_school_code, all_schools),
		'candidateCount': len(candidate_blob_names),
		'dryRun': bool(dry_run),
		'targetCacheControl': TARGET_CACHE_CONTROL,
		'inspected': inspected,
		'updated': updated,
		'skipped': skipped,
		'failed': failed,
		'results': results,
	}


def main():
	args = parse_args()
	summary = backfill_profile_image_cache_headers(
		selected_school_code=args.school_code,
		all_schools=args.all_schools,
		limit=args.limit,
		dry_run=args.dry_run,
		verbose=args.verbose,
	)
	print(json.dumps(summary, indent=2))


if __name__ == '__main__':
	main()