"""Live data contract (acceptance test 1).

Every registered column must return a value for its reference symbol, so a
renamed or removed column fails CI instead of silently rendering nulls.
Skipped when SKIP_LIVE=1 (offline runs).
"""
import os

import pytest

from pipeline import sources
from pipeline.registry import FORBIDDEN, FUND_COLUMNS, HISTORY_COLUMNS, STOCK_COLUMNS, UnknownColumnError, validate

live = pytest.mark.skipif(os.environ.get("SKIP_LIVE") == "1", reason="offline")


def test_registry_rejects_unknown_and_forbidden_columns():
    with pytest.raises(UnknownColumnError):
        validate(["close", "not_a_column"], STOCK_COLUMNS)
    for bad in FORBIDDEN:
        with pytest.raises(UnknownColumnError):
            validate([bad], STOCK_COLUMNS)


@live
@pytest.mark.parametrize("registry", [STOCK_COLUMNS, FUND_COLUMNS, HISTORY_COLUMNS], ids=["stock", "fund", "history"])
def test_every_registered_column_returns_data(registry):
    by_ref = {}
    for col, (_, _, ref) in registry.items():
        if ref:
            by_ref.setdefault(ref, []).append(col)
    for ref, cols in by_ref.items():
        row = sources.scan(cols, registry, [], "", tickers=[ref])[0]
        empty = [c for c in cols if row.get(c) in (None, [], "")]
        assert not empty, f"{ref}: registered columns returned null: {empty}"


@live
def test_gated_universe_has_no_otc_and_holdings_parse():
    rows = sources.scan_stocks()
    assert len(rows) > 2000
    assert {r["exchange"] for r in rows} <= {"NYSE", "NASDAQ", "AMEX", "CBOE"}
    h = sources.ssga_holdings("xlk")
    assert h and h["as_of"] and len(h["lines"]) > 50
    assert abs(sum(l["weight"] for l in h["lines"]) - 1) < 0.02
