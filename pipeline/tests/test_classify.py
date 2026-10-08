import pytest

from pipeline.classify import asset_class, focus, leverage


@pytest.mark.parametrize("name,factor", [
    ("ProShares UltraPro QQQ", 3.0),
    ("ProShares UltraPro Short QQQ", -3.0),
    ("ProShares UltraShort Silver", -2.0),
    ("ProShares Ultra Financials", 2.0),
    ("ProShares Short Russell2000", -1.0),
    ("Direxion Daily Semiconductor Bear 3X ETF", -3.0),
    ("Direxion Daily Semiconductor Bull 3X ETF", 3.0),
    ("Direxion Daily S&P 500 Bear 1X ETF", -1.0),
    ("GraniteShares 2x Short NVDA Daily ETF", -2.0),
    ("T-Rex 2X Inverse MSTR Daily Target ETF", -2.0),
    ("Tradr 2X Long SNDK Daily ETF", 2.0),
    ("MicroSectors Oil & Gas Exp. & Prod. 3x Leveraged ETN", 3.0),
])
def test_leveraged_and_inverse(name, factor):
    assert leverage(name) == (True, factor)


@pytest.mark.parametrize("name", [
    "Vanguard Short-Term Bond ETF",
    "Schwab Ultra-Short Income ETF",
    "Innovator U.S. Equity Ultra Buffer ETF - December",
    "Invesco S&P Ultra Dividend Revenue ETF",
    "Even Herd Long Short ETF",
    "Invesco BulletShares 2027 Corporate Bond ETF",
    "iShares Short Duration Bond Active ETF",
    "ProShares S&P 500 Dividend Aristocrats ETF",
    "SPDR S&P 500 ETF TRUST",
])
def test_ordinary_funds_not_flagged(name):
    assert leverage(name) == (False, None)


def test_codes_never_leak():
    assert asset_class("c05f85d35d1cd0be6ebb2af4be16e06a") == "Equity"
    assert asset_class("deadbeef") is None
    assert focus(63) == "Technology"
    assert focus("not-a-code") is None
