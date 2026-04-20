from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_shared_service_account():
    current_file = Path(__file__).resolve()
    for parent in current_file.parents:
        candidate = parent / 'serviceAccountKey.py'
        if not candidate.exists():
            continue

        spec = spec_from_file_location('gojo_service_account_key', candidate)
        if spec is None or spec.loader is None:
            continue

        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    raise FileNotFoundError('serviceAccountKey.py not found in parent directories.')


_SHARED = _load_shared_service_account()

FIREBASE_CREDENTIALS = _SHARED.FIREBASE_CREDENTIALS
FIREBASE_DATABASE_URL = _SHARED.FIREBASE_DATABASE_URL
FIREBASE_STORAGE_BUCKET = _SHARED.FIREBASE_STORAGE_BUCKET
get_firebase_options = _SHARED.get_firebase_options
require_firebase_credentials = _SHARED.require_firebase_credentials