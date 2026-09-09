"""Find a token not in the static cache universe. Read-only."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/home/nse/nse-signal-pipeline")
CACHE = ROOT / "config" / "membership"
# actual cache path from settings
CANDIDATES = [
    ROOT / "data" / "instruments_cache.json",
    ROOT / "data" / "cache.json",
    ROOT / "config" / "instruments_cache.json",
]


def tokens_from_cache(cache: dict) -> set[int]:
    out: set[int] = set()
    for key in ("equity", "equity_depth", "equity_quote", "index"):
        for row in (cache.get(key) or {}).values():
            if isinstance(row, dict) and row.get("instrument_token"):
                out.add(int(row["instrument_token"]))
    for key in ("options", "futures"):
        for row in cache.get(key) or []:
            if isinstance(row, dict) and row.get("instrument_token"):
                out.add(int(row["instrument_token"]))
    return out


def main() -> None:
    from nse_pipeline.config import load_settings

    settings = load_settings()
    path = settings.paths.instruments_cache
    cache = json.loads(path.read_text(encoding="utf-8"))
    static = tokens_from_cache(cache)
    print("cache", path)
    print("static_tokens", len(static))
    extras = []
    for dump in ROOT.glob("data/**/*instrument*.json"):
        extras.append(str(dump))
    print("dumps", extras[:20])
    # Prefer an NFO option-like row stored as extra metadata if present.
    leftover = cache.get("nfo_unsubscribed") or cache.get("eligible_unsubscribed") or []
    found = None
    for row in leftover:
        tok = int(row.get("instrument_token") or 0)
        if tok and tok not in static:
            found = row
            break
    print("found_leftover", found)
    # Scan any kite dump next to cache.
    parent = path.parent
    for dump in list(parent.glob("*.json")) + list((ROOT / "data").glob("*.json")):
        if dump.resolve() == path.resolve():
            continue
        try:
            payload = json.loads(dump.read_text(encoding="utf-8")[:200])
        except Exception:
            continue
        print("json_file", dump, type(payload).__name__)


if __name__ == "__main__":
    main()
