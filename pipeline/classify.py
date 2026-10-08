"""Maps the scanner's opaque fund codes to labels, and flags leveraged/inverse products.

The codes were mapped by sampling known ETFs per category (see docs/DATA.md).
An unmapped code renders as "—"; raw codes never reach the UI.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

ASSET_CLASS = {
    "c05f85d35d1cd0be6ebb2af4be16e06a": "Equity",          # VOO, QQQ, VEA, IEMG
    "b6e443a6c4a8a2e7918c5dbf3d45c796": "Fixed income",    # BND, AGG, TLT, MUB
    "8fe80395f389e29e3ea42210337f0350": "Commodity",       # GLD, SLV, PDBC
    "1af0389838508d7016a9841eb6273962": "Digital assets",  # IBIT, ETHA
    "4071518f1736a5a43dae51b47590322f": "Alternatives",    # DBMF, BUFR, BOXX
    "b090e99b8d95f5837ec178c2d3d3fc50": "Multi-asset",     # AOR, CGBL
}

FOCUS = {
    52: "Total market", 53: "Large cap", 55: "Small cap", 56: "Mid cap", 66: "Extended market",
    58: "Theme", 63: "Technology", 64: "High dividend", 68: "Health care", 61: "Industrials",
    62: "Real estate", 115: "Materials", 54: "Financials", 59: "Energy", 105: "Consumer discretionary",
    106: "Consumer staples", 2127: "Communication services", 70: "Utilities",
    73: "Investment grade", 78: "High yield", 2025: "Broad credit",
    29: "Gold", 32: "Silver", 10: "Broad commodities", 2111: "Bitcoin", 2125: "Ethereum",
    2203: "Defined outcome",
}

LEV_ISSUERS = re.compile(r"\b(Direxion|ProShares|GraniteShares|Leverage Shares|Tradr|T-Rex|Defiance|MicroSectors)\b", re.I)
FACTOR = re.compile(r"(?<![\w.])(-?\d(?:\.\d+)?)\s?X\b", re.I)
# "Short" alone is not inverse: Short-Term, Short Duration, Long Short, Ultra-Short Income are ordinary funds.
INVERSE = re.compile(r"\b(Bear|Inverse|UltraShort|UltraPro Short)\b|\b\d(?:\.\d+)?X Short\b", re.I)
ISSUER_SHORT = re.compile(r"^(ProShares|Direxion|GraniteShares|Tradr|Leverage Shares|T-Rex|Defiance)\b.*\bShort\b(?![- ](Term|Duration|Maturity))", re.I)
ISSUER_LEVER = re.compile(r"^ProShares Ultra(Pro)?\b|\bDaily Target\b|\bBull \d", re.I)


def asset_class(code: Optional[str]) -> Optional[str]:
    return ASSET_CLASS.get(code or "")


def focus(code) -> Optional[str]:
    try:
        return FOCUS.get(int(code))
    except (TypeError, ValueError):
        return None


def leverage(description: str) -> Tuple[bool, Optional[float]]:
    """Returns (is_leveraged_or_inverse, signed factor or None if not stated)."""
    d = description or ""
    m = FACTOR.search(d)
    inverse = bool(INVERSE.search(d) or ISSUER_SHORT.search(d))
    levered = bool(ISSUER_LEVER.search(d)) or bool(m and abs(float(m.group(1))) > 1)
    flagged = inverse or levered
    if not flagged:
        return False, None
    factor = abs(float(m.group(1))) if m else None
    if factor is None:
        if re.search(r"UltraPro", d, re.I):
            factor = 3.0
        elif re.search(r"Ultra", d, re.I):
            factor = 2.0
        elif inverse:
            factor = 1.0
    if factor is not None and inverse:
        factor = -factor
    return True, factor
