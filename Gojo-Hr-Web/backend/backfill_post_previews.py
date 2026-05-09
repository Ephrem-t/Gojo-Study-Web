import argparse
import io
import json
import os
import re
import sys
import time
from urllib.parse import unquote, urlparse

import firebase_admin
import requests
from firebase_admin import credentials, db, storage
from PIL import Image, ImageOps, UnidentifiedImageError

from firebase_config import FIREBASE_CREDENTIALS, FIREBASE_STORAGE_BUCKET, get_firebase_options, require_firebase_credentials


PLATFORM_ROOT = (os.getenv('PLATFORM_ROOT') or 'Platform1').strip() or 'Platform1'
SCHOOLS_ROOT = 'Schools'
DEFAULT_SCHOOL_CODE = (os.getenv('SCHOOL_CODE') or 'ET-ORO-ADA-GMI').strip() or 'ET-ORO-ADA-GMI'
PREVIEW_MAX_DIMENSION = 640
PREVIEW_MAX_BYTES = 140 * 1024
PREVIEW_INITIAL_QUALITY = 82
PREVIEW_MIN_QUALITY = 46
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff')


def ensure_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    require_firebase_credentials()
    credential = credentials.Certificate(FIREBASE_CREDENTIALS)
    return firebase_admin.initialize_app(credential, get_firebase_options())


def parse_args():
    parser = argparse.ArgumentParser(
        description='Backfill lightweight post preview images for one or all HR schools.',
    )
    parser.add_argument(
        '--school-code',
        default=DEFAULT_SCHOOL_CODE,
        help='Target one school code. Ignored when --all-schools is set.',
    )
    parser.add_argument(
        '--all-schools',
        action='store_true',
        help='Backfill post previews for every school under the platform root.',
    )
    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='Rebuild previews even when a post already has postPreviewUrl.',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of candidate posts to process across all selected schools.',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Generate previews in memory and report results without uploading or writing postPreviewUrl.',
    )
    return parser.parse_args()


def normalize_school_code(value):
    return str(value or '').strip()


def platform_ref():
    return db.reference(PLATFORM_ROOT)


def schools_root_ref():
    return platform_ref().child(SCHOOLS_ROOT)


def school_ref(school_code):
    return schools_root_ref().child(normalize_school_code(school_code))


def posts_ref(school_code):
    return school_ref(school_code).child('Posts')


def get_storage_bucket():
    try:
        return storage.bucket(FIREBASE_STORAGE_BUCKET)
    except Exception:
        return storage.bucket()


def target_school_codes(selected_school_code=None, all_schools=False):
    if all_schools:
        nodes = schools_root_ref().get() or {}
        if not isinstance(nodes, dict):
            return []
        return sorted(code for code in (normalize_school_code(value) for value in nodes.keys()) if code)

    school_code = normalize_school_code(selected_school_code or DEFAULT_SCHOOL_CODE)
    return [school_code] if school_code else []


def sanitize_identifier(value, default='asset'):
    normalized = re.sub(r'[^A-Za-z0-9_-]+', '-', str(value or '').strip()).strip('-')
    return normalized or default


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


def download_source_media(bucket, post_url):
    blob_name = parse_storage_blob_name(post_url, bucket.name)
    if blob_name:
        blob = bucket.blob(blob_name)
        blob.reload()
        return blob.download_as_bytes(), str(blob.content_type or ''), blob_name

    response = requests.get(post_url, timeout=30)
    response.raise_for_status()
    return response.content, str(response.headers.get('content-type') or ''), None


def looks_like_image(post_url, media_type='', content_type=''):
    normalized_media_type = str(media_type or '').strip().lower()
    if normalized_media_type and normalized_media_type != 'image':
        return False

    normalized_content_type = str(content_type or '').strip().lower()
    if normalized_content_type.startswith('image/'):
        return True

    return str(post_url or '').strip().lower().endswith(IMAGE_EXTENSIONS)


def convert_to_rgb(image):
    if image.mode == 'RGB':
        return image
    if image.mode == 'L':
        return image.convert('RGB')

    rgba_image = image.convert('RGBA')
    rgb_image = Image.new('RGB', rgba_image.size, (255, 255, 255))
    rgb_image.paste(rgba_image, mask=rgba_image.getchannel('A'))
    return rgb_image


def build_preview_bytes(source_bytes):
    try:
        image = Image.open(io.BytesIO(source_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError(f'Unsupported image payload: {exc}') from exc

    image = ImageOps.exif_transpose(image)
    image.load()
    image = convert_to_rgb(image)
    image.thumbnail((PREVIEW_MAX_DIMENSION, PREVIEW_MAX_DIMENSION), Image.Resampling.LANCZOS)

    best_candidate = b''
    quality = PREVIEW_INITIAL_QUALITY

    while quality >= PREVIEW_MIN_QUALITY:
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=quality, optimize=True, progressive=True)
        candidate = output.getvalue()
        best_candidate = candidate
        if len(candidate) <= PREVIEW_MAX_BYTES:
            return candidate
        quality -= 7

    return best_candidate


def build_preview_blob_name(source_blob_name, post_node, post_id):
    if source_blob_name:
        base_name, _ = os.path.splitext(source_blob_name)
        if not base_name.endswith('_preview'):
            base_name = f'{base_name}_preview'
        return f'{base_name}.jpg'

    owner_id = sanitize_identifier(post_node.get('userId') or post_node.get('ownerId') or 'hr-admin', 'hr-admin')
    post_key = sanitize_identifier(post_id, 'post')
    time_hint = sanitize_identifier(post_node.get('time') or int(time.time()), 'time')
    return f'HR/Posts/{owner_id}_{time_hint}_{post_key}_preview.jpg'


def upload_preview(bucket, preview_blob_name, preview_bytes):
    blob = bucket.blob(preview_blob_name)
    blob.upload_from_string(preview_bytes, content_type='image/jpeg')
    blob.cache_control = 'public, max-age=31536000, immutable'
    blob.patch()
    blob.make_public()
    return blob.public_url


def sorted_posts(posts_node):
    if not isinstance(posts_node, dict):
        return []

    def sort_key(item):
        post_node = item[1] if isinstance(item, tuple) and len(item) > 1 else {}
        return str((post_node or {}).get('time') or '')

    return sorted(posts_node.items(), key=sort_key, reverse=True)


def backfill_post_previews(selected_school_code=None, all_schools=False, overwrite=False, limit=None, dry_run=False):
    ensure_firebase_app()
    bucket = get_storage_bucket()
    remaining = max(0, int(limit)) if isinstance(limit, int) and limit is not None else None
    results = []

    for current_school_code in target_school_codes(selected_school_code, all_schools):
        if remaining == 0:
            break

        posts = posts_ref(current_school_code).get() or {}
        previewable_candidates = 0
        updated_posts = 0
        failed = 0
        skipped_existing_preview = 0
        skipped_non_image = 0
        skipped_missing_media = 0
        errors = []

        for post_id, post_node in sorted_posts(posts):
            if remaining == 0:
                break
            if not isinstance(post_node, dict):
                continue

            post_url = str(post_node.get('postUrl') or '').strip()
            if not post_url:
                skipped_missing_media += 1
                continue

            if not overwrite and str(post_node.get('postPreviewUrl') or '').strip():
                skipped_existing_preview += 1
                continue

            declared_media_type = str(post_node.get('mediaType') or '').strip().lower()
            if declared_media_type and declared_media_type != 'image':
                skipped_non_image += 1
                continue

            if remaining is not None:
                remaining -= 1

            try:
                source_bytes, content_type, source_blob_name = download_source_media(bucket, post_url)
                if not looks_like_image(post_url, declared_media_type, content_type):
                    skipped_non_image += 1
                    continue

                preview_bytes = build_preview_bytes(source_bytes)
                preview_blob_name = build_preview_blob_name(source_blob_name, post_node, post_id)
                previewable_candidates += 1

                if dry_run:
                    continue

                preview_url = upload_preview(bucket, preview_blob_name, preview_bytes)
                posts_ref(current_school_code).child(str(post_id)).update({'postPreviewUrl': preview_url})
                updated_posts += 1
            except Exception as exc:
                failed += 1
                if len(errors) < 10:
                    errors.append({'postId': str(post_id), 'error': str(exc)})

        results.append(
            {
                'schoolCode': current_school_code,
                'dryRun': dry_run,
                'previewableCandidates': previewable_candidates,
                'updatedPosts': updated_posts,
                'failed': failed,
                'skippedExistingPreview': skipped_existing_preview,
                'skippedNonImage': skipped_non_image,
                'skippedMissingMedia': skipped_missing_media,
                'errors': errors,
            }
        )

    return results


def main():
    args = parse_args()
    try:
        results = backfill_post_previews(
            selected_school_code=args.school_code,
            all_schools=args.all_schools,
            overwrite=args.overwrite,
            limit=args.limit,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        print(json.dumps({'error': str(exc)}, indent=2), file=sys.stderr)
        return 1

    print(json.dumps(results, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())