from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any


@dataclass
class IndicatorState:
    max_bars: int = 500
    bars: dict[str, deque[dict[str, Any]]] = field(default_factory=lambda: defaultdict(deque))

    def update(self, ticker: str, bar: dict[str, Any]) -> None:
        bucket = self.bars[ticker]
        bucket.append(bar)
        while len(bucket) > self.max_bars:
            bucket.popleft()

    def value(self, ticker: str, indicator: str, params: dict[str, Any] | None = None):
        params = params or {}
        series = list(self.bars.get(ticker, []))
        if not series:
            return None

        if indicator in {"open", "high", "low", "close", "volume"}:
            return _with_previous(series, indicator)

        period = int(params.get("period", 14))
        closes = [float(bar["close"]) for bar in series if bar.get("close") is not None]
        if len(closes) < period:
            return None

        if indicator == "sma":
            current = sum(closes[-period:]) / period
            previous = sum(closes[-period - 1 : -1]) / period if len(closes) > period else current
            return {"current": current, "prev": previous}

        if indicator == "ema":
            values = _ema_series(closes, period)
            if not values:
                return None
            return {"current": values[-1], "prev": values[-2] if len(values) > 1 else values[-1]}

        if indicator == "rsi":
            values = _rsi_series(closes, period)
            if not values:
                return None
            return {"current": values[-1], "prev": values[-2] if len(values) > 1 else values[-1]}

        return None


def _with_previous(series: list[dict[str, Any]], key: str) -> dict[str, float]:
    current = float(series[-1].get(key) or 0)
    previous = float(series[-2].get(key) or current) if len(series) > 1 else current
    return {"current": current, "prev": previous}


def _ema_series(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    out = [ema]
    for value in values[period:]:
        ema = (value - ema) * multiplier + ema
        out.append(ema)
    return out


def _rsi_series(values: list[float], period: int) -> list[float]:
    if len(values) <= period:
        return []

    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, len(values)):
        delta = values[i] - values[i - 1]
        gains.append(max(delta, 0))
        losses.append(abs(min(delta, 0)))

    out: list[float] = []
    for i in range(period, len(gains) + 1):
        avg_gain = sum(gains[i - period : i]) / period
        avg_loss = sum(losses[i - period : i]) / period
        if avg_loss == 0:
            out.append(100.0)
        else:
            rs = avg_gain / avg_loss
            out.append(100 - (100 / (1 + rs)))
    return out
