"""HTTP client for the pipeline UI API. Does not open the pipeline database."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

DEFAULT_URL = "http://127.0.0.1:8080"

_FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "api"

_PATH_TO_FIXTURE = {
    "/api/v1/overview": "overview.json",
    "/api/v1/maturity": "maturity.json",
    "/api/v1/signals": "signals.json",
    "/api/v1/account": "account.json",
    "/api/v1/decisions": "decisions.json",
    "/api/v1/health": "health.json",
    "/v1/maturity": "maturity.json",
    "/v1/signals/latest": "signals.json",
    "/v1/health": "health.json",
    "/v1/decisions": "decisions.json",
    "/v1/account/positions": "account.json",
    "/v1/account/margins": "account.json",
    "/v1/account/fills": "account.json",
    "/v1/outcomes": "decisions.json",
}


def api_url() -> str:
    return os.environ.get("NSE_API_URL", DEFAULT_URL).rstrip("/")


def use_fixtures() -> bool:
    flag = os.environ.get("NSE_USE_FIXTURES", "").strip().lower()
    if flag in {"1", "true", "yes"}:
        return True
    return api_url().lower() in {"mock", "fixture", "fixtures"}


def _load_fixture(path: str) -> dict[str, Any]:
    stem = path.split("?", 1)[0]
    name = _PATH_TO_FIXTURE.get(stem)
    if name is None:
        raise ValueError(f"no fixture mapped for {path}")
    payload = json.loads((_FIXTURE_DIR / name).read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "maturity" not in payload:
        raise ValueError("fixture missing frozen maturity envelope")
    return payload


def get_json(path: str, timeout: float = 15.0) -> dict[str, Any]:
    if use_fixtures():
        return _load_fixture(path)
    url = f"{api_url()}{path}"
    response = httpx.get(url, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or "maturity" not in payload:
        raise ValueError("API response missing frozen maturity envelope")
    return payload
