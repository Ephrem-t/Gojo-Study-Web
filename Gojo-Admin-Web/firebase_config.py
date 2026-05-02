import os
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_shared_service_account():
    service_account_key_path = os.environ.get('SERVICE_ACCOUNT_KEY_PATH')
    candidates = []

    if service_account_key_path:
        candidates.append(Path(service_account_key_path).expanduser().resolve())

    current_file = Path(__file__).resolve()
    for parent in current_file.parents:
        candidates.append(parent / 'serviceAccountKey.py')

    for candidate in candidates:
        if candidate.name != 'serviceAccountKey.py' or not candidate.is_file():
            continue

        spec = spec_from_file_location('gojo_service_account_key', candidate)
        if spec is None or spec.loader is None:
            continue

        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    if service_account_key_path:
        raise FileNotFoundError(
            'SERVICE_ACCOUNT_KEY_PATH must point to an existing serviceAccountKey.py file.'
        )

    raise FileNotFoundError('serviceAccountKey.py not found in parent directories.')


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