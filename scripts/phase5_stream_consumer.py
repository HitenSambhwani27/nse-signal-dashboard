"""Phase 5 scripted SSE consumer. Measurement only. Never synthesizes ticks."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any


def parse_sse_buffer(buffer: str) -> tuple[list[dict[str, Any]], str]:
    frames: list[dict[str, Any]] = []
    while "\n\n" in buffer:
        raw, buffer = buffer.split("\n\n", 1)
        event = "message"
        event_id: str | None = None
        data_lines: list[str] = []
        for line in raw.splitlines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("id:"):
                event_id = line[3:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
        if not data_lines:
            continue
        payload = "\n".join(data_lines)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            data = {"raw": payload}
        frames.append(
            {
                "event": event,
                "id": event_id,
                "data": data if isinstance(data, dict) else {"value": data},
                "raw": raw,
                "frame_size": len(raw.encode("utf-8")),
            }
        )
    return frames, buffer


@dataclass
class ConsumerReport:
    connected_at: float | None = None
    hello_at: float | None = None
    first_tick_at: float | None = None
    frames: list[dict[str, Any]] = field(default_factory=list)
    sequences: list[int] = field(default_factory=list)
    duplicates: int = 0
    gaps: int = 0
    out_of_order: int = 0
    regressions: int = 0
    reconnects: int = 0
    resyncs: list[dict[str, Any]] = field(default_factory=list)
    heartbeat_intervals_ms: list[float] = field(default_factory=list)
    inter_frame_ms: list[float] = field(default_factory=list)
    ages_ms: list[float] = field(default_factory=list)
    last_state: dict[int, dict[str, Any]] = field(default_factory=dict)
    last_event_id: str | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        connected = self.connected_at or 0.0
        return {
            "connection_ms": None if self.connected_at is None else 0.0,
            "hello_ms": None
            if self.hello_at is None or self.connected_at is None
            else round((self.hello_at - connected) * 1000.0, 1),
            "first_tick_ms": None
            if self.first_tick_at is None or self.connected_at is None
            else round((self.first_tick_at - connected) * 1000.0, 1),
            "total_frames": len(self.frames),
            "by_event": _counts(self.frames),
            "duplicate_count": self.duplicates,
            "gap_count": self.gaps,
            "out_of_order_count": self.out_of_order,
            "regression_count": self.regressions,
            "reconnect_count": self.reconnects,
            "resyncs": self.resyncs,
            "heartbeat_intervals_ms": self.heartbeat_intervals_ms[:50],
            "heartbeat_interval_p50_ms": _pct(self.heartbeat_intervals_ms, 50),
            "inter_frame_p50_ms": _pct(self.inter_frame_ms, 50),
            "e2e_age_p50_ms": _pct(self.ages_ms, 50),
            "e2e_age_p95_ms": _pct(self.ages_ms, 95),
            "last_event_id": self.last_event_id,
            "error": self.error,
        }


def _counts(frames: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for frame in frames:
        name = str(frame.get("event") or "message")
        out[name] = out.get(name, 0) + 1
    return out


def _pct(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round((pct / 100.0) * (len(ordered) - 1)))))
    return round(ordered[idx], 1)


def _parse_ts(value: Any) -> float | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        from datetime import datetime

        return datetime.fromisoformat(text).timestamp()
    except ValueError:
        return None


class StreamConsumer:
    def __init__(self) -> None:
        self.report = ConsumerReport()
        self._last_seq: int | None = None
        self._seen: set[int] = set()
        self._last_hb: float | None = None
        self._last_recv: float | None = None

    def accept(self, frame: dict[str, Any], *, received_at: float) -> None:
        self.report.frames.append(
            {
                "event": frame["event"],
                "id": frame.get("id"),
                "token": (frame.get("data") or {}).get("t"),
                "seq": (frame.get("data") or {}).get("seq"),
                "event_ts": (frame.get("data") or {}).get("ts"),
                "received_at": received_at,
                "frame_size": frame.get("frame_size"),
                "lag_ms": (frame.get("data") or {}).get("lag_ms"),
            }
        )
        if self._last_recv is not None:
            self.report.inter_frame_ms.append((received_at - self._last_recv) * 1000.0)
        self._last_recv = received_at
        event = frame["event"]
        data = frame.get("data") or {}
        if event == "hello":
            self.report.hello_at = self.report.hello_at or received_at
            self.report.reconnects += 1
            return
        if event == "resync":
            self.report.resyncs.append(dict(data))
            self._last_seq = None
            self._seen.clear()
            return
        if event == "heartbeat":
            if self._last_hb is not None:
                self.report.heartbeat_intervals_ms.append((received_at - self._last_hb) * 1000.0)
            self._last_hb = received_at
            return
        if event != "tick":
            return
        self.report.first_tick_at = self.report.first_tick_at or received_at
        seq_raw = frame.get("id") if frame.get("id") is not None else data.get("seq")
        try:
            seq = int(seq_raw)
        except (TypeError, ValueError):
            return
        self.report.sequences.append(seq)
        self.report.last_event_id = str(seq)
        if seq in self._seen:
            self.report.duplicates += 1
        self._seen.add(seq)
        if self._last_seq is not None:
            if seq < self._last_seq:
                self.report.out_of_order += 1
            elif seq > self._last_seq + 1:
                self.report.gaps += 1
        self._last_seq = seq
        ts = _parse_ts(data.get("ts"))
        if ts is not None:
            self.report.ages_ms.append(max((received_at - ts) * 1000.0, 0.0))
        token = data.get("t")
        if token is None:
            return
        try:
            token_i = int(token)
        except (TypeError, ValueError):
            return
        prev = self.report.last_state.get(token_i)
        cur_ts = str(data.get("ts") or "")
        if prev is not None:
            prev_ts = str(prev.get("ts") or "")
            if cur_ts and prev_ts and cur_ts < prev_ts:
                self.report.regressions += 1
        merged = dict(prev or {})
        merged.update(data)
        self.report.last_state[token_i] = merged


def load_tokens(path: str | None, raw: str | None) -> list[int]:
    if raw:
        return [int(p) for p in raw.split(",") if p.strip()]
    if not path:
        return []
    text = open(path, encoding="utf-8").read().strip()
    if path.endswith(".json"):
        payload = json.loads(text)
        if isinstance(payload, list):
            return [int(x) for x in payload]
        return [int(x) for x in payload.get("tokens") or []]
    return [int(p) for p in text.replace(",", "\n").split() if p.strip()]


def rest_get(url: str, timeout: float = 10.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def consume_stream(
    *,
    url: str,
    seconds: float,
    last_event_id: str | None = None,
) -> StreamConsumer:
    consumer = StreamConsumer()
    headers = {"Accept": "text/event-stream", "Cache-Control": "no-cache"}
    if last_event_id:
        headers["Last-Event-ID"] = last_event_id
    req = urllib.request.Request(url, headers=headers)
    t0 = time.time()
    consumer.report.connected_at = t0
    deadline = t0 + seconds
    try:
        with urllib.request.urlopen(req, timeout=seconds + 5) as resp:
            buffer = ""
            while time.time() < deadline:
                chunk = resp.read(2048)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                frames, buffer = parse_sse_buffer(buffer)
                now = time.time()
                for frame in frames:
                    consumer.accept(frame, received_at=now)
                if time.time() >= deadline:
                    break
    except Exception as exc:
        consumer.report.error = str(exc)
    return consumer


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 5 live SSE consumer")
    parser.add_argument("--api", default="http://127.0.0.1:8080")
    parser.add_argument("--tokens")
    parser.add_argument("--tokens-file")
    parser.add_argument("--groups", default="price,volume,oi,depth,quality")
    parser.add_argument("--seconds", type=float, default=20.0)
    parser.add_argument("--last-event-id")
    parser.add_argument("--reconnect", action="store_true")
    parser.add_argument("--out")
    args = parser.parse_args()
    tokens = load_tokens(args.tokens_file, args.tokens)
    if not tokens:
        print("tokens required", file=sys.stderr)
        return 2
    if len(tokens) > 250:
        print("instrument_limit_exceeded locally; cap is 250", file=sys.stderr)
        return 2
    url = f"{args.api.rstrip('/')}/api/v1/stream?tokens={','.join(str(t) for t in tokens)}&groups={args.groups}"
    first = consume_stream(url=url, seconds=args.seconds, last_event_id=args.last_event_id)
    payload: dict[str, Any] = {"first": first.report.to_dict(), "token_count": len(tokens)}
    if args.reconnect:
        second = consume_stream(
            url=url,
            seconds=min(args.seconds, 8.0),
            last_event_id=first.report.last_event_id,
        )
        payload["reconnect"] = second.report.to_dict()
    text = json.dumps(payload, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
