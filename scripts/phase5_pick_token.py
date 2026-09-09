"""Pick one eligible NFO option token that is not in the static cache. REST only."""
from __future__ import annotations

import json
from pathlib import Path

from nse_pipeline.broker.instruments import all_subscribed_instruments, load_instrument_cache
from nse_pipeline.config import load_settings
from kiteconnect import KiteConnect


def main() -> None:
    settings = load_settings()
    cache = load_instrument_cache(settings.paths.instruments_cache)
    static = {int(i.instrument_token) for i in all_subscribed_instruments(cache)}
    kite = KiteConnect(api_key=settings.kite.api_key)
    token = settings.kite.access_token
    if not token:
        raise SystemExit("no access token in settings")
    kite.set_access_token(token)
    rows = kite.instruments("NFO")
    found = None
    near = None
    for row in rows:
        if str(row.get("name") or "") != "NIFTY":
            continue
        if str(row.get("instrument_type") or "") not in {"CE", "PE"}:
            continue
        tok = int(row["instrument_token"])
        if tok in static:
            continue
        strike = float(row.get("strike") or 0)
        item = {
            "instrument_token": tok,
            "tradingsymbol": row.get("tradingsymbol"),
            "expiry": str(row.get("expiry")),
            "strike": strike,
            "instrument_type": row.get("instrument_type"),
        }
        if found is None:
            found = item
        if 22000 <= strike <= 25000:
            near = item
            break
    pick = near or found
    Path("/tmp/phase5_dynamic_token.json").write_text(
        json.dumps({"static": len(static), "pick": pick, "far_fallback": found}, indent=2)
    )
    print(json.dumps({"static": len(static), "pick": pick}))


if __name__ == "__main__":
    main()
