import os
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_shared_service_account():
    service_account_key_path = os.environ.get('SERVICE_ACCOUNT_KEY_PATH')
    if not service_account_key_path:
        raise FileNotFoundError(
            'SERVICE_ACCOUNT_KEY_PATH must be set to the exact path of serviceAccountKey.py.'
        )

    candidate = Path(service_account_key_path).expanduser().resolve()
    if candidate.name != 'serviceAccountKey.py' or not candidate.is_file():
        raise FileNotFoundError(
            'SERVICE_ACCOUNT_KEY_PATH must point to an existing serviceAccountKey.py file.'
        )

    spec = spec_from_file_location('gojo_service_account_key', candidate)
    if spec is None or spec.loader is None:
        raise ImportError(f'Unable to load service account module from {candidate}.')

    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_SHARED = _load_shared_service_account()

FIREBASE_CREDENTIALS = _SHARED.FIREBASE_CREDENTIALS
FIREBASE_DATABASE_URL = _SHARED.FIREBASE_DATABASE_URL
FIREBASE_STORAGE_BUCKET = _SHARED.FIREBASE_STORAGE_BUCKET
get_firebase_options = _SHARED.get_firebase_options
require_firebase_credentials = _SHARED.require_firebase_credentials