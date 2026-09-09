"""One controlled systemd ingest restart. Never starts a second ingest process."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "http://127.0.0.1:8080"
DB = Path("/home/nse/nse-signal-pipeline/data/nse_pipeline.db")
TOKEN = 12144898  # NIFTY2691526200CE — not in static 1285
STREAM_TOKENS = [256265, 260105, 341249, 17611778, TOKEN]


def sh(cmd: str) -> str:
    return subprocess.check_output(["bash", "-lc", cmd], text=True).strip()


def http_json(path: str, *, data: bytes | None = None, timeout: float = 20):
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        API + path,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8")), dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8") or "{}"), dict(exc.headers)


def parse_sse(buffer: str):
    frames = []
    while "\n\n" in buffer:
        raw, buffer = buffer.split("\n\n", 1)
        event = "message"
        event_id = None
        data_lines = []
        for line in raw.splitlines():
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("id:"):
                event_id = line[3:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
        if not data_lines:
            continue
        try:
            data = json.loads("\n".join(data_lines))
        except json.JSONDecodeError:
            data = {}
        frames.append({"event": event, "id": event_id, "data": data})
    return frames, buffer


def consume_until(stop: threading.Event, bucket: list, seconds: float) -> None:
    url = f"{API}/api/v1/stream?tokens={','.join(str(t) for t in STREAM_TOKENS)}&groups=price,volume,quality"
    req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=seconds + 10) as resp:
            buf = ""
            while time.time() < t0 + seconds and not stop.is_set():
                chunk = resp.read(2048)
                if not chunk:
                    break
                buf += chunk.decode("utf-8", errors="replace")
                frames, buf = parse_sse(buf)
                now = time.time()
                for fr in frames:
                    fr["recv"] = now
                    bucket.append(fr)
    except Exception as exc:
        bucket.append({"event": "error", "data": {"error": str(exc)}, "recv": time.time()})


def subs_rows():
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            "SELECT token, requester, status, reason, expires_at, capabilities_json FROM subscription_requests"
        ).fetchall()
        return [list(r) for r in rows]
    finally:
        conn.close()


def quote_row(token: int):
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    try:
        row = conn.execute(
            """
            SELECT instrument_token, symbol, last_price, timestamp, ingested_at, volume_delta
            FROM latest_quotes WHERE instrument_token=?
            """,
            (token,),
        ).fetchone()
        return list(row) if row else None
    finally:
        conn.close()


def meta_tail():
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    try:
        return conn.execute(
            """
            SELECT id, timestamp, event_type, message FROM ingestion_meta
            WHERE event_type IN ('startup','warm_start','connect','subscription_reconcile')
            ORDER BY id DESC LIMIT 12
            """
        ).fetchall()
    finally:
        conn.close()


def unusual():
    code, body, _ = http_json("/api/v1/unusual-activity?limit=20")
    rows = body.get("unusual_activity") or []
    return {"http": code, "count": len(rows), "sample": rows[:5]}


def main() -> None:
    report: dict = {"started_at": datetime.now(timezone.utc).isoformat()}
    report["ingest_before"] = sh("pgrep -af '[p]ython .*01_run_ingestion.py' || true")
    report["ingest_active_before"] = sh("systemctl is-active nse-ingest")
    _, health, _ = http_json("/api/v1/health")
    report["health_before"] = {
        "stream": (health.get("health") or {}).get("stream"),
        "busy": (health.get("health") or {}).get("sqlite_busy_retries"),
        "data_state": health.get("data_state"),
        "ingest_component": ((health.get("health") or {}).get("components") or {}).get("ingestion"),
    }
    report["token_before"] = quote_row(TOKEN)
    body = json.dumps(
        {
            "token": TOKEN,
            "requester": "phase5-runtime",
            "action": "subscribe",
            "capabilities": ["price", "volume"],
            "ttl_seconds": 3600,
        }
    ).encode("utf-8")
    code, posted, _ = http_json("/api/v1/subscriptions", data=body)
    report["subscribe"] = {"http": code, "body": posted}
    report["subs_after_post"] = subs_rows()

    stop = threading.Event()
    frames: list[dict] = []
    thread = threading.Thread(target=consume_until, args=(stop, frames, 90), daemon=True)
    thread.start()
    t_wait = time.time()
    while time.time() - t_wait < 15:
        if any(f.get("event") == "tick" for f in frames):
            break
        time.sleep(0.2)
    report["pre_restart_ticks"] = sum(1 for f in frames if f.get("event") == "tick")
    report["pre_restart_hello"] = any(f.get("event") == "hello" for f in frames)
    report["generation_before"] = ((health.get("health") or {}).get("stream") or {}).get("ingest_generation")

    report["restart_issued_at"] = datetime.now(timezone.utc).isoformat()
    t_restart = time.time()
    subprocess.check_call(["sudo", "systemctl", "restart", "nse-ingest"])
    report["restart_return_at"] = datetime.now(timezone.utc).isoformat()
    report["restart_systemctl_s"] = round(time.time() - t_restart, 3)

    # Immediate uniqueness checks.
    time.sleep(1.0)
    report["ingest_status"] = sh("systemctl is-active nse-ingest")
    report["ingest_after"] = sh("pgrep -af '[p]ython .*01_run_ingestion.py' || true")
    report["ingest_count"] = sh("pgrep -c -f '[p]ython .*01_run_ingestion.py' || true")
    report["journal"] = sh("journalctl -u nse-ingest -n 40 --no-pager")

    # Wait for live data + resync.
    deadline = time.time() + 45
    while time.time() < deadline:
        if any(
            f.get("event") == "resync" and (f.get("data") or {}).get("reason") == "ingestion_restart"
            for f in frames
        ) and quote_row(256265):
            break
        time.sleep(0.5)
    report["resync_wait_s"] = round(time.time() - t_restart, 3)
    stop.set()
    thread.join(timeout=5)

    report["frames_by_event"] = {}
    for f in frames:
        ev = f.get("event")
        report["frames_by_event"][ev] = report["frames_by_event"].get(ev, 0) + 1
    report["resyncs"] = [f.get("data") for f in frames if f.get("event") == "resync"]
    report["sessions"] = [f.get("data") for f in frames if f.get("event") == "session"]
    post_ticks = [f for f in frames if f.get("event") == "tick" and f.get("recv", 0) >= t_restart]
    report["post_restart_ticks"] = len(post_ticks)
    report["post_restart_tokens"] = sorted(
        {int(f["data"]["t"]) for f in post_ticks if isinstance(f.get("data"), dict) and f["data"].get("t")}
    )
    report["dynamic_ticks"] = sum(
        1 for f in post_ticks if (f.get("data") or {}).get("t") == TOKEN
    )
    hello = next((f.get("data") for f in frames if f.get("event") == "hello"), None)
    report["hello_coverage"] = (hello or {}).get("session")
    _, health2, _ = http_json("/api/v1/health")
    report["health_after"] = {
        "stream": (health2.get("health") or {}).get("stream"),
        "busy": (health2.get("health") or {}).get("sqlite_busy_retries"),
        "data_state": health2.get("data_state"),
        "ingest_component": ((health2.get("health") or {}).get("components") or {}).get("ingestion"),
    }
    report["subs_after_restart"] = subs_rows()
    report["token_after"] = quote_row(TOKEN)
    report["nifty_after"] = quote_row(256265)
    report["meta"] = [list(r) for r in meta_tail()]
    report["unusual"] = unusual()
    # REST rehydrate vs last stream tick for NIFTY
    _, nifty, _ = http_json("/api/v1/quotes/NIFTY%2050")
    q = nifty.get("quote") or {}
    last_nifty = None
    for f in reversed(post_ticks):
        if (f.get("data") or {}).get("t") == 256265 and "ltp" in (f.get("data") or {}):
            last_nifty = f["data"]
            break
    report["rehydrate"] = {
        "rest_ltp": q.get("last_price"),
        "rest_chg": q.get("change_absolute"),
        "rest_chgp": q.get("change_percent"),
        "rest_status": (nifty.get("data_state") or {}).get("data_status"),
        "stream_last": last_nifty,
    }
    # release
    rel = json.dumps(
        {
            "token": TOKEN,
            "requester": "phase5-runtime",
            "action": "release",
            "capabilities": ["price"],
        }
    ).encode("utf-8")
    rcode, rbody, _ = http_json("/api/v1/subscriptions", data=rel)
    report["release"] = {"http": rcode, "body": rbody}
    time.sleep(2)
    report["subs_after_release"] = subs_rows()
    report["ingest_final"] = sh("pgrep -af '[p]ython .*01_run_ingestion.py' || true")
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    Path("/tmp/phase5_restart.json").write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps({k: report[k] for k in (
        "ingest_before",
        "ingest_after",
        "ingest_count",
        "ingest_status",
        "subscribe",
        "resyncs",
        "frames_by_event",
        "post_restart_ticks",
        "dynamic_ticks",
        "health_after",
        "subs_after_restart",
        "token_after",
        "rehydrate",
        "release",
        "restart_systemctl_s",
        "resync_wait_s",
    ) if k in report}, indent=2, default=str))


if __name__ == "__main__":
    main()
