#!/usr/bin/env python3
"""Phase 5 precheck. Read-only. No ingest restart."""
from __future__ import annotations

import json
import sqlite3
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "http://127.0.0.1:8080"
CANDIDATES = [
    Path("/home/nse/nse-signal-pipeline/data/nse_pipeline.db"),
    Path("/home/nse/nse-signal-pipeline/data/nse.db"),
    Path("/home/nse/nse-signal-pipeline/data/pipeline.db"),
    Path("/home/nse/nse-signal-pipeline/data/market.db"),
]


def sh(cmd: str) -> str:
    return subprocess.check_output(["bash", "-lc", cmd], text=True).strip()


def http(path: str):
    req = urllib.request.Request(API + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    health = http("/api/v1/health")
    h = health.get("health") or {}
    quotes = {}
    for symbol in ("NIFTY 50", "NIFTY BANK", "HDFCBANK"):
        enc = urllib.request.quote(symbol, safe="")
        quotes[symbol] = http(f"/api/v1/quotes/{enc}")
    db = next((p for p in CANDIDATES if p.exists()), None)
    if db is None:
        data = Path("/home/nse/nse-signal-pipeline/data")
        dbs = list(data.glob("*.db")) if data.exists() else []
        db = dbs[0] if dbs else None
    info = {
        "now": datetime.now(timezone.utc).isoformat(),
        "ingest_active": sh("systemctl is-active nse-ingest || true"),
        "api_active": sh("systemctl is-active nse-api || true"),
        "ingest_pgrep": sh("pgrep -af '[p]ython .*01_run_ingestion.py' || true"),
        "api_pgrep": sh("pgrep -af '[p]ython .*14_run_ui_api.py' || true"),
        "manual_ingest": sh("pgrep -af 'nohup|screen|tmux' || true"),
        "kite_sockets": sh("ss -tp 2>/dev/null | grep -E 'kite|zerodha|:443' | head -n 20 || true"),
        "db": str(db) if db else None,
        "token_health": h.get("token") or h.get("kite") or h.get("components"),
        "stream": h.get("stream"),
        "busy": h.get("sqlite_busy_retries"),
        "data_state": health.get("data_state"),
        "account_status": ((h.get("processing_status") or {}).get("account") or {}).get("status"),
        "last_meta": h.get("last_ingestion_meta"),
        "quotes": {
            k: {
                "ltp": (v.get("quote") or {}).get("last_price"),
                "chg": (v.get("quote") or {}).get("change_absolute"),
                "chgp": (v.get("quote") or {}).get("change_percent"),
                "ref": (v.get("quote") or {}).get("reference_price"),
                "reft": (v.get("quote") or {}).get("reference_type"),
                "ts": (v.get("quote") or {}).get("timestamp"),
                "status": (v.get("data_state") or {}).get("data_status"),
                "market": (v.get("data_state") or {}).get("market_state"),
            }
            for k, v in quotes.items()
        },
    }
    if db and db.exists():
        wal = Path(str(db) + "-wal")
        info["wal_bytes"] = wal.stat().st_size if wal.exists() else 0
        conn = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
        try:
            info["quote_count"] = conn.execute("SELECT COUNT(*) FROM latest_quotes").fetchone()[0]
            info["max_quote_ts"] = conn.execute(
                "SELECT MAX(timestamp) FROM latest_quotes"
            ).fetchone()[0]
            info["max_ingested_at"] = conn.execute(
                "SELECT MAX(ingested_at) FROM latest_quotes"
            ).fetchone()[0]
            info["tokens"] = [
                r[0]
                for r in conn.execute(
                    """
                    SELECT instrument_token FROM latest_quotes
                    WHERE last_price IS NOT NULL
                    ORDER BY CASE WHEN volume IS NULL THEN 1 ELSE 0 END, volume DESC
                    LIMIT 250
                    """
                )
            ]
            info["pending_subs"] = [
                dict(zip([c[0] for c in conn.execute("PRAGMA table_info(subscription_requests)")], row))
                for row in conn.execute("SELECT * FROM subscription_requests")
            ]
            info["recent_meta"] = conn.execute(
                """
                SELECT id, timestamp, event_type, message FROM ingestion_meta
                ORDER BY id DESC LIMIT 8
                """
            ).fetchall()
        finally:
            conn.close()
    Path("/tmp/phase5_precheck.json").write_text(json.dumps(info, indent=2, default=str))
    print(json.dumps(info, indent=2, default=str)[:8000])


if __name__ == "__main__":
    main()
