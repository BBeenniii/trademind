from __future__ import annotations
import pandas as pd

TIMEFRAME_RULES = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
}

def resample_ohlcv(frame: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    if timeframe not in TIMEFRAME_RULES:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    if timeframe == "1m":
        return frame.copy()

    # Preserve standard OHLCV semantics when deriving wider bars from minute data.
    indexed = frame.set_index("timestamp")
    resampled = indexed.resample(TIMEFRAME_RULES[timeframe]).agg(
        {
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }
    )
    return resampled.dropna(subset=["open", "high", "low", "close"]).reset_index()