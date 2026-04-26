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


_SHARED = None


def _get_shared_service_account():
    global _SHARED
    if _SHARED is None:
        _SHARED = _load_shared_service_account()
    return _SHARED


def get_firebase_options(*args, **kwargs):
    return _get_shared_service_account().get_firebase_options(*args, **kwargs)


def require_firebase_credentials(*args, **kwargs):
    return _get_shared_service_account().require_firebase_credentials(*args, **kwargs)


def __getattr__(name):
    if name in {
        'FIREBASE_CREDENTIALS',
        'FIREBASE_DATABASE_URL',
        'FIREBASE_STORAGE_BUCKET',
    }:
        return getattr(_get_shared_service_account(), name)
    raise AttributeError(f'module {__name__!r} has no attribute {name!r}')