"""Read-only Phase 5 collectors. Run on the VM. Does not restart ingest."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "http://127.0.0.1:8080"
DB = Path("/home/nse/nse-signal-pipeline/data/nse_pipeline.db")


def http_get(path: str) -> dict:
    req = urllib.request.Request(API + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def pgrep(pattern: str) -> str:
    proc = subprocess.run(
        ["bash", "-lc", f"pgrep -af {pattern!s} || true"],
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.stdout.strip()


def main() -> None:
    health = http_get("/api/v1/health")
    quotes = {}
    for symbol in ("NIFTY 50", "NIFTY BANK", "HDFCBANK"):
        encoded = urllib.request.quote(symbol, safe="")
        quotes[symbol] = http_get(f"/api/v1/quotes/{encoded}")
    ingest = pgrep("'[p]ython .*01_run_ingestion.py'")
    api = pgrep("'[p]ython .*14_run_ui_api.py'")
    ss = subprocess.run(
        ["bash", "-lc", "ss -tp 2>/dev/null | rg -n 'kite|zerodha|8884|443' || true"],
        capture_output=True,
        text=True,
        check=False,
    )
    coverage = None
    tokens: list[int] = []
    wal_size = None
    if DB.exists():
        wal = Path(str(DB) + "-wal")
        wal_size = wal.stat().st_size if wal.exists() else 0
        conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            coverage = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT id, timestamp, event_type, message, details_json
                    FROM ingestion_meta
                    WHERE event_type IN ('startup','warm_start','connect','subscription_reconcile')
                    ORDER BY id DESC LIMIT 20
                    """
                )
            ]
            tokens = [
                int(r[0])
                for r in conn.execute(
                    """
                    SELECT instrument_token FROM latest_quotes
                    WHERE last_price IS NOT NULL
                    ORDER BY CASE WHEN volume IS NULL THEN 1 ELSE 0 END, volume DESC
                    LIMIT 250
                    """
                )
            ]
        finally:
            conn.close()
    payload = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "ingest_pgrep": ingest,
        "api_pgrep": api,
        "sockets": ss.stdout.strip(),
        "health": health.get("health"),
        "quotes": {
            k: {
                "ltp": (v.get("quote") or {}).get("last_price"),
                "change_absolute": (v.get("quote") or {}).get("change_absolute"),
                "change_percent": (v.get("quote") or {}).get("change_percent"),
                "data_status": (v.get("data_state") or {}).get("data_status"),
                "as_of": (v.get("data_state") or {}).get("as_of"),
            }
            for k, v in quotes.items()
        },
        "ingest_events": coverage,
        "token_count": len(tokens),
        "tokens": tokens,
        "wal_bytes": wal_size,
        "busy_retries": (health.get("health") or {}).get("sqlite_busy_retries"),
    }
    out = Path("/tmp/phase5_collect.json")
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(out.read_text(encoding="utf-8")[:4000])
    print("wrote", out, "tokens", len(tokens))


if __name__ == "__main__":
    main()
    _ = time.time()
