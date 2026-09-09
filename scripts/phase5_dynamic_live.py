"""Apply a nearer dynamic option to the RUNNING ingest. No restart."""
from __future__ import annotations

import json
import sqlite3
import time
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8080"
DB = Path("/home/nse/nse-signal-pipeline/data/nse_pipeline.db")
PICK = json.loads(Path("/tmp/phase5_dynamic_token.json").read_text())["pick"]
TOKEN = int(PICK["instrument_token"])


def post(body: dict):
    req = urllib.request.Request(
        API + "/api/v1/subscriptions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def health():
    req = urllib.request.Request(API + "/api/v1/health", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def consume(seconds=12):
    url = f"{API}/api/v1/stream?tokens={TOKEN},256265&groups=price,volume,quality"
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
    return frames


def main():
    print("PICK", PICK)
    posted = post(
        {
            "token": TOKEN,
            "requester": "phase5-near",
            "action": "subscribe",
            "capabilities": ["price", "volume"],
            "ttl_seconds": 1800,
        }
    )
    print("POSTED", posted)
    time.sleep(3)
    conn = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    sub = list(conn.execute("SELECT token, requester, status, reason FROM subscription_requests WHERE token=?", (TOKEN,)))
    quote = conn.execute(
        "SELECT instrument_token, symbol, last_price, timestamp, volume_delta FROM latest_quotes WHERE instrument_token=?",
        (TOKEN,),
    ).fetchone()
    recon = conn.execute(
        """
        SELECT timestamp, details_json FROM ingestion_meta
        WHERE event_type='subscription_reconcile' ORDER BY id DESC LIMIT 3
        """
    ).fetchall()
    conn.close()
    frames = consume(12)
    dyn_ticks = [f for f in frames if f["event"] == "tick" and (f["data"] or {}).get("t") == TOKEN]
    h = health()
    out = {
        "pick": PICK,
        "posted": posted,
        "sub": sub,
        "quote": list(quote) if quote else None,
        "reconcile": [list(r) for r in recon],
        "dynamic_tick_count": len(dyn_ticks),
        "dynamic_tick_sample": dyn_ticks[:3],
        "stream": (h.get("health") or {}).get("stream"),
        "ingest_check": True,
    }
    Path("/tmp/phase5_dynamic_live.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=2, default=str)[:5000])


if __name__ == "__main__":
    main()
