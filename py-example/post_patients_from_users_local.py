#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
from urllib import request

DB_CLI_PATH = os.getenv("DB_CLI_PATH", r"C:\Users\Admin\AppData\Roaming\npm\db-cli.ps1")
BASE_URL = os.getenv("PATIENT_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
JWT_SECRET = os.getenv("PATIENT_API_JWT_SECRET", "accident-patient-jwt-2026-plk").strip()

TH_TRIAGE_EMERGENCY = "Emergency (\u0e09\u0e38\u0e01\u0e40\u0e09\u0e34\u0e19)"
TH_STATUS_ADMIT = "\u0e23\u0e31\u0e1a\u0e44\u0e27\u0e49\u0e23\u0e31\u0e01\u0e29\u0e32"
TH_MALE = "\u0e0a\u0e32\u0e22"
TH_FEMALE = "\u0e2b\u0e0d\u0e34\u0e07"


def configure_stdio() -> None:
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


def load_active_users() -> list[dict[str, str]]:
    sql = "SELECT username, hcode, hname FROM public.users WHERE is_active = true ORDER BY hcode;"
    command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        DB_CLI_PATH,
        "--engine",
        "postgres",
        "--host",
        "127.0.0.1",
        "--port",
        "55432",
        "--user",
        "postgres",
        "--password",
        "postgres",
        "--database",
        "accident",
        "--exec",
        sql,
    ]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    rows: list[dict[str, str]] = []
    for line in result.stdout.splitlines()[1:]:
        if not line.strip():
            continue
        username, hcode, hname = (line.split("|", 2) + ["", "", ""])[:3]
        if hcode and hname:
            rows.append({"username": username, "hcode": hcode, "hname": hname})
    return rows


def post_patient(token: str, payload: dict[str, object]) -> dict[str, object]:
    req = request.Request(
        url=f"{BASE_URL}/api/patient?token={token}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json; charset=utf-8"},
    )
    with request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def main() -> int:
    configure_stdio()
    token = make_token(JWT_SECRET)
    users = load_active_users()
    created: list[dict[str, object]] = []
    base_cid = 9151799999920

    for index, user in enumerate(users, start=1):
        payload = {
            "hoscode": user["hcode"],
            "hosname": user["hname"],
            "hn": None,
            "cid": str(base_cid + index),
            "patient_name": f"AUTO {user['hcode']}",
            "visit_date": "2026-04-07",
            "visit_time": f"10:{index:02d}:00",
            "sex": TH_MALE if index % 2 else TH_FEMALE,
            "age": 20 + index,
            "triage": TH_TRIAGE_EMERGENCY,
            "status": TH_STATUS_ADMIT,
            "cc": f"batch create for {user['hcode']}",
            "pdx": "S09.9-Injury of head, unspecified",
            "ext_dx": "V28.9-Motorcycle rider injured, unspecified",
            "source": "man",
            "alcohol": 0,
        }
        response = post_patient(token, payload)
        row = response.get("row", {})
        created.append(
            {
                "id": row.get("id"),
                "hoscode": user["hcode"],
                "hosname": user["hname"],
            }
        )

    print(json.dumps({"created_count": len(created), "rows": created}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
