#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path
from urllib import error, request

BASE_URL = os.getenv("PATIENT_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
SECRET = os.getenv("PATIENT_API_JWT_SECRET", "accident-patient-jwt-2026-plk").strip()
DEFAULT_JSON_PATH = Path(__file__).with_name("patient.json")


def configure_stdio() -> None:
    # Force UTF-8 on Windows terminals so Thai text prints correctly.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def make_token(secret: str, ttl_seconds: int = 3600) -> str:
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = b64url(
        json.dumps({"scope": "patient-api", "exp": int(time.time()) + ttl_seconds}, separators=(",", ":")).encode(
            "utf-8"
        )
    )
    sig = b64url(hmac.new(secret.encode("utf-8"), f"{header}.{payload}".encode("ascii"), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def load_patient_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"patient json not found: {path}")

    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    if not isinstance(data, dict):
        raise ValueError("patient json must contain an object at the top level")

    return data


def post_patient(payload: dict) -> dict:
    token = make_token(SECRET)
    url = f"{BASE_URL}/api/patient?token={token}"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json; charset=utf-8"},
    )

    try:
        with request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {details}") from exc


def main(argv: list[str]) -> int:
    configure_stdio()
    json_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_JSON_PATH

    try:
        payload = load_patient_json(json_path)
        response = post_patient(payload)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(response, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
