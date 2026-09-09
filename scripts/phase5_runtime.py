"""Phase 5 live validation on the VM. Does not restart ingest."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

API = "http://127.0.0.1:8080"
DB = Path("/home/nse/nse-signal-pipeline/data/nse_pipeline.db")
OUT = Path("/tmp/phase5_runtime.json")


def http_json(path: str, *, data: bytes | None = None, headers: dict | None = None, timeout: float = 20):
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(API + path, data=data, headers=hdrs, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {"raw": body}
        return exc.code, payload, dict(exc.headers)


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
            data = {"raw": "\n".join(data_lines)}
        frames.append({"event": event, "id": event_id, "data": data, "size": len(raw.encode("utf-8")), "raw": raw})
    return frames, buffer


def consume(tokens, seconds, last_event_id=None, groups="price,volume,quality"):
    url = (
        f"{API}/api/v1/stream?tokens={','.join(str(t) for t in tokens)}&groups={groups}"
    )
    headers = {"Accept": "text/event-stream", "Cache-Control": "no-cache"}
    if last_event_id:
        headers["Last-Event-ID"] = str(last_event_id)
    req = urllib.request.Request(url, headers=headers)
    t0 = time.time()
    out = {
        "connected_at": t0,
        "hello_at": None,
        "first_tick_at": None,
        "events": [],
        "seqs": [],
        "dupes": 0,
        "gaps": 0,
        "ooo": 0,
        "resyncs": [],
        "heartbeats": [],
        "ages_ms": [],
        "last_id": None,
        "error": None,
        "inter_ms": [],
    }
    seen = set()
    last_seq = None
    last_recv = None
    last_hb = None
    try:
        with urllib.request.urlopen(req, timeout=seconds + 8) as resp:
            buf = ""
            while time.time() < t0 + seconds:
                chunk = resp.read(4096)
                if not chunk:
                    break
                buf += chunk.decode("utf-8", errors="replace")
                frames, buf = parse_sse(buf)
                now = time.time()
                for fr in frames:
                    if last_recv is not None:
                        out["inter_ms"].append((now - last_recv) * 1000)
                    last_recv = now
                    rec = {
                        "event": fr["event"],
                        "id": fr["id"],
                        "token": (fr["data"] or {}).get("t"),
                        "seq": (fr["data"] or {}).get("seq"),
                        "ts": (fr["data"] or {}).get("ts"),
                        "recv": now,
                        "size": fr["size"],
                        "lag_ms": (fr["data"] or {}).get("lag_ms"),
                    }
                    out["events"].append(rec)
                    if fr["event"] == "hello":
                        out["hello_at"] = out["hello_at"] or now
                    elif fr["event"] == "resync":
                        out["resyncs"].append(fr["data"])
                        last_seq = None
                        seen.clear()
                    elif fr["event"] == "heartbeat":
                        if last_hb is not None:
                            out["heartbeats"].append((now - last_hb) * 1000)
                        last_hb = now
                    elif fr["event"] == "tick":
                        out["first_tick_at"] = out["first_tick_at"] or now
                        try:
                            seq = int(fr["id"] if fr["id"] is not None else fr["data"].get("seq"))
                        except (TypeError, ValueError):
                            continue
                        out["seqs"].append(seq)
                        out["last_id"] = str(seq)
                        if seq in seen:
                            out["dupes"] += 1
                        seen.add(seq)
                        if last_seq is not None:
                            if seq < last_seq:
                                out["ooo"] += 1
                            elif seq > last_seq + 1:
                                out["gaps"] += 1
                        last_seq = seq
                        ts = fr["data"].get("ts")
                        if ts:
                            try:
                                from datetime import datetime as dt

                                age = now - dt.fromisoformat(str(ts).replace("Z", "+00:00")).timestamp()
                                out["ages_ms"].append(max(age * 1000, 0))
                            except ValueError:
                                pass
    except Exception as exc:
        out["error"] = str(exc)
    out["hello_ms"] = None if not out["hello_at"] else round((out["hello_at"] - t0) * 1000, 1)
    out["first_tick_ms"] = None if not out["first_tick_at"] else round((out["first_tick_at"] - t0) * 1000, 1)
    out["frame_count"] = len(out["events"])
    by = {}
    for e in out["events"]:
        by[e["event"]] = by.get(e["event"], 0) + 1
    out["by_event"] = by
    # Drop bulky event list from disk summary; keep first/last few.
    out["event_sample"] = out["events"][:8] + out["events"][-4:]
    del out["events"]
    return out


def pct(values, p):
    if not values:
        return None
    s = sorted(values)
    i = min(len(s) - 1, max(0, int(round((p / 100) * (len(s) - 1)))))
    return round(s[i], 1)


def pgrep():
    return subprocess.check_output(
        ["bash", "-lc", "pgrep -af '[p]ython .*01_run_ingestion.py' || true"],
        text=True,
    ).strip()


def rest_quote(symbol: str) -> dict:
    enc = quote(symbol, safe="")
    c, body, _ = http_json("/api/v1/quotes/" + enc)
    q = body.get("quote") or {}
    st = body.get("data_state") or {}
    return {
        "http": c,
        "token": q.get("instrument_token"),
        "ltp": q.get("last_price"),
        "chg": q.get("change_absolute"),
        "chgp": q.get("change_percent"),
        "ref": q.get("reference_price"),
        "reft": q.get("reference_type"),
        "ts": q.get("timestamp"),
        "status": st.get("data_status"),
    }


def tokens_250():
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            """
            SELECT instrument_token FROM latest_quotes
            WHERE last_price IS NOT NULL
            ORDER BY CASE WHEN volume IS NULL THEN 1 ELSE 0 END, volume DESC
            LIMIT 250
            """
        ).fetchall()
        return [int(r[0]) for r in rows]
    finally:
        conn.close()


def main():
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ingest_before": pgrep(),
    }
    code, health, _ = http_json("/api/v1/health")
    report["health_before"] = {
        "http": code,
        "stream": (health.get("health") or {}).get("stream"),
        "busy": (health.get("health") or {}).get("sqlite_busy_retries"),
        "data_state": health.get("data_state"),
    }
    report["rest_core"] = {}
    rest = {}
    for symbol in ("NIFTY 50", "NIFTY BANK", "HDFCBANK"):
        enc = quote(symbol, safe="")
        c, body, _ = http_json("/api/v1/quotes/" + enc)
        q = body.get("quote") or {}
        st = body.get("data_state") or {}
        rest[symbol] = {
            "http": c,
            "token": q.get("instrument_token"),
            "ltp": q.get("last_price"),
            "chg": q.get("change_absolute"),
            "chgp": q.get("change_percent"),
            "ref": q.get("reference_price"),
            "reft": q.get("reference_type"),
            "ts": q.get("timestamp"),
            "status": st.get("data_status"),
        }
    report["rest_core"] = rest
    stream_tokens = [
        rest["NIFTY 50"]["token"] or 256265,
        rest["NIFTY BANK"]["token"] or 260105,
        rest["HDFCBANK"]["token"] or 341249,
        17611778,
    ]
    report["normal_stream"] = consume(stream_tokens, 12)
    n = report["normal_stream"]
    n["age_p50"] = pct(n.get("ages_ms") or [], 50)
    n["age_p95"] = pct(n.get("ages_ms") or [], 95)
    n["hb_p50"] = pct(n.get("heartbeats") or [], 50)

    # Last-Event-ID same-process: reconnect with last id.
    last_id = n.get("last_id")
    report["reconnect_same_process"] = consume(stream_tokens, 6, last_event_id=last_id)
    report["reconnect_gap"] = consume(stream_tokens, 4, last_event_id="1")
    report["reconnect_future_seq"] = consume(stream_tokens, 4, last_event_id="99999999")

    toks = tokens_250()
    report["token250_count"] = len(toks)
    report["stream_250"] = consume(toks, 12)
    s250 = report["stream_250"]
    s250["age_p50"] = pct(s250.get("ages_ms") or [], 50)
    s250["age_p95"] = pct(s250.get("ages_ms") or [], 95)
    s250["hb_p50"] = pct(s250.get("heartbeats") or [], 50)

    # 16 connections + 17th
    import threading

    results = []

    def hold():
        results.append(consume([256265], 6))

    threads = [threading.Thread(target=hold) for _ in range(16)]
    for t in threads:
        t.start()
    time.sleep(1.2)
    req17 = urllib.request.Request(
        f"{API}/api/v1/stream?tokens=256265",
        headers={"Accept": "text/event-stream"},
    )
    try:
        with urllib.request.urlopen(req17, timeout=5) as resp17:
            report["conn17"] = {
                "http": resp17.status,
                "retry": resp17.headers.get("Retry-After"),
                "ctype": resp17.headers.get("Content-Type"),
            }
    except urllib.error.HTTPError as exc:
        report["conn17"] = {
            "http": exc.code,
            "retry": exc.headers.get("Retry-After") if exc.headers else None,
            "body": exc.read().decode("utf-8")[:300],
        }
    for t in threads:
        t.join()
    report["conn16_ok"] = sum(1 for r in results if r.get("hello_at"))
    report["conn16_errors"] = [r.get("error") for r in results if r.get("error")]
    report["ingest_after"] = pgrep()
    codeh, health2, _ = http_json("/api/v1/health")
    report["health_after"] = {
        "http": codeh,
        "stream": (health2.get("health") or {}).get("stream"),
        "busy": (health2.get("health") or {}).get("sqlite_busy_retries"),
    }
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps({k: report[k] for k in report if k not in {"stream_250", "normal_stream"}}, indent=2, default=str)[:5000])
    print("wrote", OUT)


if __name__ == "__main__":
    main()
