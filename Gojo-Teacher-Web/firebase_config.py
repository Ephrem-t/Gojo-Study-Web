import base64
import json
import os
from pathlib import Path


def _read_env_value(*names, required=False):
    for name in names:
        value = str(os.getenv(name) or "").strip()
        if value:
            return value

    if required:
        joined_names = ", ".join(names)
        raise RuntimeError(f"Missing required Firebase environment variable. Set one of: {joined_names}")

    return ""


def _load_json_credentials(raw_payload, source_name):
    try:
        parsed_payload = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{source_name} does not contain valid JSON.") from exc

    if not isinstance(parsed_payload, dict):
        raise RuntimeError(f"{source_name} must resolve to a JSON object.")

    return parsed_payload


def _load_firebase_credentials():
    direct_json = _read_env_value(
        "FIREBASE_SERVICE_ACCOUNT_JSON",
        "GOJO_FIREBASE_SERVICE_ACCOUNT_JSON",
    )
    if direct_json:
        return _load_json_credentials(direct_json, "FIREBASE_SERVICE_ACCOUNT_JSON")

    base64_json = _read_env_value(
        "FIREBASE_SERVICE_ACCOUNT_BASE64",
        "GOJO_FIREBASE_SERVICE_ACCOUNT_BASE64",
    )
    if base64_json:
        try:
            decoded_payload = base64.b64decode(base64_json).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64-encoded JSON.") from exc
        return _load_json_credentials(decoded_payload, "FIREBASE_SERVICE_ACCOUNT_BASE64")

    credentials_path = _read_env_value(
        "FIREBASE_CREDENTIALS_PATH",
        "GOJO_FIREBASE_CREDENTIALS_PATH",
    )
    if credentials_path:
        resolved_path = Path(credentials_path).expanduser().resolve()
        if not resolved_path.exists():
            raise RuntimeError(f"Firebase credentials file was not found at {resolved_path}")
        return str(resolved_path)

    raise RuntimeError(
        "Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, "
        "FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_CREDENTIALS_PATH."
    )


FIREBASE_CREDENTIALS = _load_firebase_credentials()
FIREBASE_DATABASE_URL = _read_env_value(
    "FIREBASE_DATABASE_URL",
    "GOJO_FIREBASE_DATABASE_URL",
    required=True,
)
FIREBASE_STORAGE_BUCKET = _read_env_value(
    "FIREBASE_STORAGE_BUCKET",
    "GOJO_FIREBASE_STORAGE_BUCKET",
)


def get_firebase_options():
    options = {"databaseURL": FIREBASE_DATABASE_URL}
    if FIREBASE_STORAGE_BUCKET:
        options["storageBucket"] = FIREBASE_STORAGE_BUCKET
    return options


def require_firebase_credentials():
    return FIREBASE_CREDENTIALS