"""The banner must show N/60 and must never look like a confident probability."""

from __future__ import annotations

from nse_dashboard.banner import (
    MaturityBanner,
    assert_no_fabricated_probability,
    banner_markdown,
    probability_cell,
)
from nse_dashboard.client import get_json, use_fixtures

SUPPRESSED = {
    "equity": {
        "tier": "suppressed",
        "pooled_live_days": 2,
        "threshold_days": 60,
        "display": "insufficient data, 2/60 pooled days",
        "probability_permitted": False,
        "probability": None,
    },
    "futures": {
        "tier": "suppressed",
        "pooled_live_days": 2,
        "threshold_days": 60,
        "display": "insufficient data, 2/60 pooled days",
        "probability_permitted": False,
    },
    "options_nifty": {
        "tier": "suppressed",
        "pooled_live_days": 2,
        "threshold_days": 60,
        "display": "insufficient data, 2/60 pooled days",
        "probability_permitted": False,
    },
    "options_banknifty": {
        "tier": "suppressed",
        "pooled_live_days": 0,
        "threshold_days": 60,
        "display": "insufficient data, 0/60 pooled days",
        "probability_permitted": False,
    },
}


def test_banner_renders_insufficient_data_not_a_probability() -> None:
    text = MaturityBanner(SUPPRESSED)
    assert text == banner_markdown(SUPPRESSED)
    assert "insufficient data" in text
    assert "2/60" in text
    assert "0.62" not in text
    assert "62%" not in text
    assert_no_fabricated_probability(SUPPRESSED)


def test_probability_column_uses_display_string() -> None:
    cell = probability_cell(
        {
            "probability": 0.62,
            "score": 0.24,
            "probability_permitted": False,
            "display": "insufficient data, 2/60 pooled days",
        }
    )
    assert cell == "insufficient data, 2/60 pooled days"
    assert "0.62" not in cell
    assert "0.00" not in cell


def test_dashboard_does_not_import_pipeline() -> None:
    import nse_dashboard.app as app
    import nse_dashboard.banner as banner
    import nse_dashboard.client as client

    for mod in (app, banner, client):
        source = getattr(mod, "__file__", "")
        text = open(source, encoding="utf-8").read()
        assert "import nse_pipeline" not in text
        assert "from nse_pipeline" not in text
        assert "sqlite3" not in text
        assert "SQLiteStore" not in text
        assert "kite" not in text.lower()


def test_fixture_mode_loads_2_of_60_without_network(monkeypatch) -> None:
    monkeypatch.setenv("NSE_USE_FIXTURES", "1")
    assert use_fixtures() is True
    payload = get_json("/api/v1/maturity")
    eq = payload["maturity"]["equity"]
    assert eq["display"] == "insufficient data, 2/60 pooled days"
    assert eq["pooled_live_days"] == 2
    assert eq["probability_permitted"] is False
    text = banner_markdown(payload["maturity"])
    assert "2/60" in text
    sig = get_json("/api/v1/signals")
    assert sig["signals"]
    cell = probability_cell(sig["signals"][0])
    assert cell == "insufficient data, 2/60 pooled days"
    assert "0.62" not in cell
    assert sig["signals"][0]["probability"] is None
    blob = str(sig)
    assert "features_json" not in blob
    assert "attribution" not in blob
    overview = get_json("/api/v1/overview")
    assert "maturity" in overview
    health = get_json("/api/v1/health")
    assert "maturity" in health


def test_mock_url_selects_fixtures(monkeypatch) -> None:
    monkeypatch.setenv("NSE_API_URL", "mock")
    monkeypatch.delenv("NSE_USE_FIXTURES", raising=False)
    assert use_fixtures() is True
    payload = get_json("/api/v1/health")
    assert payload["maturity"]["equity"]["display"].startswith("insufficient data")
