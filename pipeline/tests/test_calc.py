import math
import random
import statistics

from pipeline.calc import drift_adjust, effective_n, normalize, overlap, realized_vol


def reference_rv(closes, window):
    rets = [math.log(closes[i] / closes[i - 1]) for i in range(len(closes) - window, len(closes))]
    return statistics.stdev(rets) * math.sqrt(252) * 100


def test_realized_vol_matches_independent_calc_to_4dp():
    random.seed(7)
    closes = [100.0]
    for _ in range(300):
        closes.append(closes[-1] * math.exp(random.gauss(0, 0.02)))
    for w in (20, 60):
        assert round(realized_vol(closes, w), 4) == round(reference_rv(closes, w), 4)


def test_realized_vol_needs_enough_bars():
    assert realized_vol([1.0] * 20, 20) is None
    assert realized_vol([1.0, 0.0] + [1.0] * 20, 20) is None


def test_overlap_identical_and_disjoint():
    spy = normalize({"AAPL": 7, "MSFT": 6, "NVDA": 8, "rest": 79})
    assert abs(overlap(spy, spy) - 1) < 1e-12
    assert overlap(spy, {"UST 2Y": 0.5, "UST 10Y": 0.5}) == 0
    assert overlap(spy, {"AAPL": 1.0}) == spy["AAPL"]


def test_drift_adjusted_weights_sum_to_one():
    w = normalize({"A": 0.5, "B": 0.3, "C": 0.2})
    d = drift_adjust(w, {"A": 0.10, "B": -0.05})
    assert abs(sum(d.values()) - 1) <= 0.001
    assert d["A"] > w["A"] and d["B"] < w["B"]


def test_effective_n():
    assert effective_n([0.25] * 4) == 4
    assert effective_n([]) is None
