"""Read-only follow-up after the controlled ingest restart. No second restart."""
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
TOKEN = 12144898


def sh(cmd: str) -> str:
    return subprocess.check_output(["bash", "-lc", cmd], text=True).strip()


def http(path: str, timeout: float = 40):
    req = urllib.request.Request(API + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def consume_hello(seconds=8):
    url = f"{API}/api/v1/stream?tokens=256265,260105,341249,17611778,{TOKEN}&groups=price,volume,quality,session"
    req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
    t0 = time.time()
    frames = []
    buf = ""
    with urllib.request.urlopen(req, timeout=seconds + 5) as resp:
        while time.time() < t0 + seconds:
            chunk = resp.read(2048)
            if not chunk:
                break
            buf += chunk.decode("utf-8", errors="replace")
            while "\n\n" in buf:
                raw, buf = buf.split("\n\n", 1)
                event = "message"
                data_lines = []
                for line in raw.splitlines():
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:"):
                        data_lines.append(line[5:].lstrip())
                if not data_lines:
                    continue
                try:
                    data = json.loads("\n".join(data_lines))
                except json.JSONDecodeError:
                    data = {}
                frames.append({"event": event, "data": data})
                if event == "hello" and any(f["event"] == "tick" for f in frames):
                    break
    return frames


def main():
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    subs = list(conn.execute("SELECT * FROM subscription_requests"))
    dyn = conn.execute(
        "SELECT instrument_token, symbol, last_price, timestamp, ingested_at, volume_delta FROM latest_quotes WHERE instrument_token=?",
        (TOKEN,),
    ).fetchone()
    static_check = {}
    for tok, name in (
        (256265, "NIFTY50"),
        (260105, "NIFTYBANK"),
        (341249, "HDFCBANK"),
        (17611778, "TATASTEEL26SEPFUT"),
    ):
        static_check[name] = conn.execute(
            "SELECT last_price, timestamp, volume_delta FROM latest_quotes WHERE instrument_token=?",
            (tok,),
        ).fetchone()
    # one option already in static
    opt = conn.execute(
        """
        SELECT instrument_token, symbol, last_price, timestamp
        FROM latest_quotes
        WHERE symbol LIKE '%CE' OR symbol LIKE '%PE'
        ORDER BY timestamp DESC LIMIT 1
        """
    ).fetchone()
    meta = list(
        conn.execute(
            """
            SELECT id, timestamp, event_type, message, details_json
            FROM ingestion_meta
            WHERE event_type IN ('startup','warm_start','connect','subscription_reconcile','disconnect')
            ORDER BY id DESC LIMIT 20
            """
        )
    )
    gen = conn.execute(
        "SELECT COALESCE(MAX(id),0) FROM ingestion_meta WHERE event_type IN ('startup','warm_start')"
    ).fetchone()[0]
    conn.close()
    health = http("/api/v1/health")
    frames = consume_hello(10)
    nifty = http("/api/v1/quotes/NIFTY%2050")
    try:
        unusual = http("/api/v1/unusual-activity?limit=5", timeout=60)
        unusual_out = {
            "count": len(unusual.get("unusual_activity") or []),
            "sample": (unusual.get("unusual_activity") or [])[:3],
        }
    except Exception as exc:
        unusual_out = {"error": str(exc)}
    last_nifty_tick = None
    for f in reversed(frames):
        if f["event"] == "tick" and (f["data"] or {}).get("t") == 256265 and "ltp" in (f["data"] or {}):
            last_nifty_tick = f["data"]
            break
    dyn_ticks = sum(1 for f in frames if f["event"] == "tick" and (f["data"] or {}).get("t") == TOKEN)
    hello = next((f["data"] for f in frames if f["event"] == "hello"), None)
    sessions = [f["data"] for f in frames if f["event"] == "session"]
    payload = {
        "now": datetime.now(timezone.utc).isoformat(),
        "ingest": sh("pgrep -af '[p]ython .*01_run_ingestion.py' || true"),
        "ingest_count": sh("pgrep -c -f '[p]ython .*01_run_ingestion.py' || true"),
        "api": sh("pgrep -af '[p]ython .*14_run_ui_api.py' || true"),
        "ss": sh("ss -tp | grep -E 'python|443' | head -n 30 || true"),
        "subs": [list(r) for r in subs],
        "dynamic_quote": list(dyn) if dyn else None,
        "static_check": {k: list(v) if v else None for k, v in static_check.items()},
        "option_sample": list(opt) if opt else None,
        "meta": [list(r) for r in meta],
        "generation": gen,
        "stream_health": (health.get("health") or {}).get("stream"),
        "busy": (health.get("health") or {}).get("sqlite_busy_retries"),
        "data_state": health.get("data_state"),
        "hello_session": (hello or {}).get("session"),
        "sessions": sessions,
        "frame_events": {},
        "dynamic_ticks": dyn_ticks,
        "nifty_rest": {
            "ltp": (nifty.get("quote") or {}).get("last_price"),
            "chg": (nifty.get("quote") or {}).get("change_absolute"),
            "chgp": (nifty.get("quote") or {}).get("change_percent"),
            "status": (nifty.get("data_state") or {}).get("data_status"),
        },
        "nifty_stream": last_nifty_tick,
        "unusual": unusual_out,
    }
    for f in frames:
        payload["frame_events"][f["event"]] = payload["frame_events"].get(f["event"], 0) + 1
    Path("/tmp/phase5_restart_followup.json").write_text(json.dumps(payload, indent=2, default=str))
    print(json.dumps(payload, indent=2, default=str)[:12000])


if __name__ == "__main__":
    main()
