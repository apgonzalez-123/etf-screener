"""Pure calculations. Every formula here is shown in the UI next to its output."""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence

TRADING_DAYS = 252


def realized_vol(closes: Sequence[float], window: int) -> Optional[float]:
    """Annualized close-to-close realized volatility, in percent.

    sigma = sqrt(252) * stdev(ln(C_t / C_{t-1})) over the last `window` returns,
    sample stdev (n - 1). Returns None if there are fewer than window + 1 closes
    or any close is non-positive.
    """
    if len(closes) < window + 1:
        return None
    tail = closes[-(window + 1):]
    if any(c is None or c <= 0 for c in tail):
        return None
    rets = [math.log(tail[i] / tail[i - 1]) for i in range(1, len(tail))]
    mean = sum(rets) / len(rets)
    var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)
    return math.sqrt(var) * math.sqrt(TRADING_DAYS) * 100


def overlap(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Weight-based symmetric overlap: sum over common issuers of min(w_a, w_b).

    Weights are fractions that each sum to ~1. Result is in [0, 1].
    """
    return sum(min(w, b[k]) for k, w in a.items() if k in b)


def normalize(weights: Dict[str, float]) -> Dict[str, float]:
    total = sum(weights.values())
    if total <= 0:
        return {}
    return {k: v / total for k, v in weights.items()}


def drift_adjust(weights: Dict[str, float], returns_since_asof: Dict[str, float]) -> Dict[str, float]:
    """w'_i = w_i (1 + r_i) / sum_j w_j (1 + r_j). Missing returns are treated as 0."""
    grown = {k: w * (1 + returns_since_asof.get(k, 0.0)) for k, w in weights.items()}
    return normalize(grown)


def effective_n(weights: Sequence[float]) -> Optional[float]:
    """Effective number of holdings = 1 / sum(w^2), weights as fractions."""
    s = sum(w * w for w in weights)
    return 1 / s if s > 0 else None


def pct_from(price: Optional[float], ref: Optional[float]) -> Optional[float]:
    if price is None or ref is None or ref == 0:
        return None
    return (price / ref - 1) * 100


def spark(closes: List[float], n: int = 30) -> List[float]:
    return [round(c, 4) for c in closes[-n:]]
