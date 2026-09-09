"""Phase 5 consumer parser tests. No live market data."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "phase5_stream_consumer",
    ROOT / "scripts" / "phase5_stream_consumer.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_parse_sse_and_integrity() -> None:
    raw = (
        "event: hello\ndata: {\"connection_id\":\"x\"}\n\n"
        "id: 1\nevent: tick\ndata: {\"t\":1,\"ts\":\"2026-09-09T04:00:00+00:00\",\"seq\":1,\"ltp\":10}\n\n"
        "id: 2\nevent: tick\ndata: {\"t\":1,\"ts\":\"2026-09-09T04:00:01+00:00\",\"seq\":2,\"ltp\":11}\n\n"
        "event: heartbeat\ndata: {\"lag_ms\":1800}\n\n"
    )
    frames, rest = MODULE.parse_sse_buffer(raw)
    assert rest == ""
    consumer = MODULE.StreamConsumer()
    for i, frame in enumerate(frames):
        consumer.accept(frame, received_at=1.0 + i)
    report = consumer.report.to_dict()
    assert report["duplicate_count"] == 0
    assert report["gap_count"] == 0
    assert report["out_of_order_count"] == 0
    assert report["regression_count"] == 0
    assert report["by_event"]["heartbeat"] == 1
    assert consumer.report.last_event_id == "2"
