"""Maturity banner — required on every page. Never invents a probability."""

from __future__ import annotations

from typing import Any

CLASS_ORDER = (
    "equity",
    "futures",
    "options_nifty",
    "options_banknifty",
)


def MaturityBanner(maturity: dict[str, Any]) -> str:
    """Public name required by the architecture; same formatter as banner_markdown."""
    return banner_markdown(maturity)


def banner_markdown(maturity: dict[str, Any]) -> str:
    lines = [
        "### Data maturity",
        "A probability is shown only after **60 pooled live days** per class. "
        "Until then this banner is the signal.",
    ]
    for key in CLASS_ORDER:
        view = maturity.get(key) or {}
        display = str(view.get("display") or "insufficient data")
        tier = view.get("tier") or "suppressed"
        permitted = bool(view.get("probability_permitted"))
        if permitted:
            lines.append(f"- **{key}** ({tier}): {display}")
        else:
            lines.append(f"- **{key}** ({tier}): **{display}**")
    return "\n".join(lines)


def probability_cell(signal: dict[str, Any]) -> str:
    """Probability column: text N/60 when the gate is closed, never 0.00."""
    if not signal.get("probability_permitted"):
        return str(signal.get("display") or "insufficient data")
    value = signal.get("probability")
    if value is None:
        return str(signal.get("display") or "insufficient data")
    return f"{float(value):.3f}"


def assert_no_fabricated_probability(maturity: dict[str, Any]) -> None:
    for view in maturity.values():
        if not isinstance(view, dict):
            continue
        if view.get("probability_permitted"):
            continue
        if view.get("probability") not in (None,):
            raise AssertionError("suppressed/provisional maturity carried a probability")
