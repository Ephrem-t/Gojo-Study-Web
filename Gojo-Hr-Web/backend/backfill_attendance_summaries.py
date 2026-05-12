import argparse
import json
import sys

from hr_app import DEFAULT_SCHOOL_CODE, backfill_attendance_summaries


def parse_args():
    parser = argparse.ArgumentParser(
        description='Backfill Employees_Attendance_Summary from Employees_Attendance.',
    )
    parser.add_argument(
        '--school-code',
        default=DEFAULT_SCHOOL_CODE,
        help='Target one school code. Ignored when --all-schools is set.',
    )
    parser.add_argument(
        '--all-schools',
        action='store_true',
        help='Backfill attendance summaries for every school under the platform root.',
    )
    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='Rebuild summaries even when summary entries already exist.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    results = backfill_attendance_summaries(
        school_code=args.school_code,
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