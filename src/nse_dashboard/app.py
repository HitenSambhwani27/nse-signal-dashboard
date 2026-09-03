"""Streamlit dashboard. Read-only. Maturity banner on every page."""

from __future__ import annotations

import streamlit as st

from nse_dashboard.banner import MaturityBanner, probability_cell
from nse_dashboard.client import get_json, use_fixtures


def _show_banner(payload: dict) -> None:
    st.markdown(MaturityBanner(payload.get("maturity") or {}))


def page_overview() -> None:
    payload = get_json("/api/v1/overview")
    _show_banner(payload)
    st.subheader("Pooled live days")
    rows = []
    for key, view in (payload.get("maturity") or {}).items():
        if not isinstance(view, dict):
            continue
        rows.append(
            {
                "class": key,
                "days": view.get("pooled_live_days"),
                "threshold": view.get("threshold_days"),
                "tier": view.get("tier"),
                "status": view.get("display"),
                "probability_permitted": view.get("probability_permitted"),
            }
        )
    st.dataframe(rows, hide_index=True, use_container_width=True)
    st.caption(
        f"last ingest={payload.get('last_ingest')}  "
        f"last feature={payload.get('last_feature')}  "
        f"last signal={payload.get('last_signal')}"
    )


def page_signals() -> None:
    payload = get_json("/api/v1/signals")
    _show_banner(payload)
    table = []
    for row in payload.get("signals") or []:
        table.append(
            {
                "timestamp": row.get("timestamp"),
                "symbol": row.get("symbol"),
                "track": row.get("track"),
                "probability": probability_cell(row),
                "tier": row.get("tier") or row.get("maturity_tier"),
            }
        )
    if table:
        st.dataframe(table, hide_index=True, use_container_width=True)
    else:
        st.info("No live-engine signal rows yet. Gate state is still shown above.")


def page_account() -> None:
    payload = get_json("/api/v1/account")
    _show_banner(payload)
    st.subheader("Positions")
    st.json(payload.get("positions") or {"empty": True})
    st.subheader("Margins")
    st.json(payload.get("margins") or {"empty": True})
    st.subheader("Fills")
    rows = payload.get("fills") or []
    if rows:
        st.dataframe(rows, hide_index=True, use_container_width=True)
    else:
        st.info("No fills captured yet.")


def page_decisions() -> None:
    payload = get_json("/api/v1/decisions")
    _show_banner(payload)
    rows = payload.get("decisions") or []
    if not rows:
        st.info("No trades yet — not a fake Sharpe.")
    else:
        st.dataframe(rows, hide_index=True, use_container_width=True)
    st.subheader("Decision quality 2x2")
    counts = payload.get("class_counts") or {}
    if counts:
        st.json(counts)
    else:
        st.info("No scored outcomes yet.")


def page_health() -> None:
    payload = get_json("/api/v1/health")
    _show_banner(payload)
    st.json(payload.get("health") or {})


def main() -> None:
    st.set_page_config(page_title="NSE signals", layout="wide")
    st.title("NSE signals")
    if use_fixtures():
        st.caption("Fixture mode — no live API.")
    page = st.sidebar.radio(
        "Page",
        ("Overview", "Signals", "Account", "Decisions", "Health"),
    )
    try:
        if page == "Overview":
            page_overview()
        elif page == "Signals":
            page_signals()
        elif page == "Account":
            page_account()
        elif page == "Decisions":
            page_decisions()
        else:
            page_health()
    except Exception as exc:
        st.error(f"API unavailable: {exc}")
        st.caption(
            "Start the pipeline API (`python scripts/14_run_ui_api.py`) and SSH-tunnel "
            "to :8080, or set NSE_USE_FIXTURES=1 / NSE_API_URL=mock."
        )


if __name__ == "__main__":
    main()
