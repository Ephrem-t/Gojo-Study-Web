import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, db

from firebase_config import FIREBASE_CREDENTIALS, get_firebase_options, require_firebase_credentials


PLATFORM_ROOT = (os.getenv('PLATFORM_ROOT') or 'Platform1').strip() or 'Platform1'
SCHOOLS_ROOT = 'Schools'
DEFAULT_SCHOOL_CODE = (os.getenv('SCHOOL_CODE') or 'ET-ORO-ADA-GMI').strip() or 'ET-ORO-ADA-GMI'
CHAT_SUMMARY_NODE = 'Chat_Summaries'


def ensure_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    require_firebase_credentials()
    credential = credentials.Certificate(FIREBASE_CREDENTIALS)
    return firebase_admin.initialize_app(credential, get_firebase_options())


def parse_args():
    parser = argparse.ArgumentParser(
        description='Backfill Chat_Summaries from Chats metadata for one or all schools.',
    )
    parser.add_argument(
        '--school-code',
        default=DEFAULT_SCHOOL_CODE,
        help='Target one school code. Ignored when --all-schools is set.',
    )
    parser.add_argument(
        '--all-schools',
        action='store_true',
        help='Backfill chat summaries for every school under the platform root.',
    )
    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='Rebuild summaries even when a Chat_Summaries entry already exists.',
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


def run_with_retry(operation, attempts=3, delay_seconds=0.5):
    last_error = None

    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except Exception as exc:
            last_error = exc
            if attempt >= attempts:
                break
            time.sleep(delay_seconds * attempt)

    if last_error is not None:
        raise last_error

    return None


def parse_timestamp(value):
    if isinstance(value, (int, float)):
        return int(value)

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return 0

        if stripped.isdigit():
            return int(stripped)

        try:
            return int(datetime.fromisoformat(stripped.replace('Z', '+00:00')).timestamp() * 1000)
        except ValueError:
            return 0

    return 0


def get_message_preview(message):
    if not isinstance(message, dict):
        return '', 'text'

    message_type = str(message.get('type') or 'text').strip().lower() or 'text'
    if message_type == 'image':
        return 'Image', 'image'
    if message_type == 'video':
        return 'Video', 'video'
    return str(message.get('text') or '').strip(), message_type


def extract_participant_ids(chat_id, chat_node):
    participant_ids = []
    participants_map = chat_node.get('participants') if isinstance(chat_node, dict) else {}

    if isinstance(participants_map, dict):
        participant_ids = [str(user_id or '').strip() for user_id, enabled in participants_map.items() if enabled]

    participant_ids = [user_id for user_id in participant_ids if user_id]
    if participant_ids:
        return sorted(set(participant_ids))

    return [segment for segment in str(chat_id or '').split('_') if segment]


def get_latest_message(chat_node):
    last_message = chat_node.get('lastMessage') if isinstance(chat_node, dict) else None
    if isinstance(last_message, dict) and parse_timestamp(last_message.get('timeStamp')):
        return last_message

    messages = chat_node.get('messages') if isinstance(chat_node, dict) else {}
    if not isinstance(messages, dict):
        return None

    latest = None
    latest_time = 0

    for message in messages.values():
        if not isinstance(message, dict) or message.get('deleted'):
            continue

        message_time = parse_timestamp(message.get('timeStamp'))
        if message_time > latest_time:
            latest_time = message_time
            latest = message

    return latest


def get_unread_count_for_owner(chat_node, owner_user_id):
    unread_map = chat_node.get('unread') if isinstance(chat_node, dict) else {}
    if isinstance(unread_map, dict) and owner_user_id in unread_map:
        try:
            return max(0, int(unread_map.get(owner_user_id) or 0))
        except (TypeError, ValueError):
            return 0

    messages = chat_node.get('messages') if isinstance(chat_node, dict) else {}
    if not isinstance(messages, dict):
        return 0

    unread_count = 0
    for message in messages.values():
        if not isinstance(message, dict) or message.get('deleted'):
            continue
        if message.get('seen'):
            continue
        if str(message.get('receiverId') or '').strip() != owner_user_id:
            continue
        unread_count += 1

    return unread_count


def build_summary_entry(chat_id, chat_node, owner_user_id, other_user_id):
    latest_message = get_latest_message(chat_node)
    unread_count = get_unread_count_for_owner(chat_node, owner_user_id)

    preview_text, preview_type = get_message_preview(latest_message or {})
    last_message_time = parse_timestamp((latest_message or {}).get('timeStamp'))
    last_sender_id = str((latest_message or {}).get('senderId') or '').strip()

    if not unread_count and not last_message_time:
        return None

    return {
        'chatId': str(chat_id or '').strip(),
        'otherUserId': str(other_user_id or '').strip(),
        'unreadCount': unread_count,
        'lastMessageText': preview_text,
        'lastMessageType': preview_type,
        'lastMessageTime': last_message_time,
        'lastSenderId': last_sender_id,
        'updatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    }


def target_school_codes(selected_school_code=None, all_schools=False):
    if all_schools:
        nodes = run_with_retry(lambda: schools_root_ref().get()) or {}
        if not isinstance(nodes, dict):
            return []
        return sorted(code for code in (normalize_school_code(value) for value in nodes.keys()) if code)

    school_code = normalize_school_code(selected_school_code or DEFAULT_SCHOOL_CODE)
    return [school_code] if school_code else []


def backfill_chat_summaries(selected_school_code=None, all_schools=False, overwrite=False):
    ensure_firebase_app()
    results = []

    for current_school_code in target_school_codes(selected_school_code, all_schools):
        current_school_ref = school_ref(current_school_code)
        chats = run_with_retry(lambda: current_school_ref.child('Chats').get()) or {}
        existing_summaries = {} if overwrite else (run_with_retry(lambda: current_school_ref.child(CHAT_SUMMARY_NODE).get()) or {})

        if not isinstance(chats, dict):
            chats = {}
        if not isinstance(existing_summaries, dict):
            existing_summaries = {}

        summary_updates_by_owner = {}
        skipped_existing_entries = 0
        skipped_empty_entries = 0

        for chat_id, chat_node in chats.items():
            if not isinstance(chat_node, dict):
                continue

            participant_ids = extract_participant_ids(chat_id, chat_node)
            if len(participant_ids) < 2:
                continue

            for owner_user_id in participant_ids:
                other_user_ids = [participant_id for participant_id in participant_ids if participant_id != owner_user_id]
                other_user_id = other_user_ids[0] if other_user_ids else ''
                if not other_user_id:
                    continue

                if not overwrite and isinstance(existing_summaries.get(owner_user_id), dict) and chat_id in existing_summaries[owner_user_id]:
                    skipped_existing_entries += 1
                    continue

                summary_entry = build_summary_entry(chat_id, chat_node, owner_user_id, other_user_id)
                if not summary_entry:
                    skipped_empty_entries += 1
                    continue

                summary_updates_by_owner.setdefault(owner_user_id, {})[chat_id] = summary_entry

        for owner_user_id, owner_updates in summary_updates_by_owner.items():
            run_with_retry(lambda: current_school_ref.child(CHAT_SUMMARY_NODE).child(owner_user_id).update(owner_updates))

        results.append({
            'schoolCode': current_school_code,
            'chatCount': len(chats),
            'ownerSummaryBucketsTouched': len(summary_updates_by_owner),
            'summaryEntriesWritten': sum(len(owner_updates) for owner_updates in summary_updates_by_owner.values()),
            'skippedExistingEntries': skipped_existing_entries,
            'skippedEmptyEntries': skipped_empty_entries,
            'overwrite': bool(overwrite),
        })

    return results


def main():
    args = parse_args()
    results = backfill_chat_summaries(
        selected_school_code=args.school_code,
        all_schools=args.all_schools,
        overwrite=args.overwrite,
    )
    print(json.dumps({'ok': True, 'results': results}, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        raise SystemExit(1)