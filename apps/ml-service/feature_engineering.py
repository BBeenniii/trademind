from __future__ import annotations
import os
import numpy as np
import pandas as pd

MODEL_FEATURES = [
    "return_1",
    "return_3",
    "return_5",
    "log_return",
    "volatility_10",
    "volatility_30",
    "sma_10",
    "sma_30",
    "sma_50",
    "sma_diff_10_30",
    "ema_12",
    "ema_26",
    "rsi_14",
    "macd",
    "macd_signal",
    "macd_hist",
    "momentum_5",
    "momentum_10",
    "rolling_high_20",
    "rolling_low_20",
    "price_position_20",
    "hour_of_day",
    "day_of_week",
]

def engineer_market_features(prices: pd.DataFrame, include_target: bool = True) -> pd.DataFrame:
    frame = _clean_prices(prices)
    close = frame["close"]
    # Trend, momentum, volatility and session context keep the tabular model explainable.
    frame["return_1"] = close.pct_change()
    frame["return_3"] = close.pct_change(3)
    frame["return_5"] = close.pct_change(5)
    frame["log_return"] = np.log(close / close.shift(1))
    frame["volatility_10"] = frame["return_1"].rolling(10).std()
    frame["volatility_30"] = frame["return_1"].rolling(30).std()
    frame["sma_10"] = close.rolling(10).mean()
    frame["sma_30"] = close.rolling(30).mean()
    frame["sma_50"] = close.rolling(50).mean()
    frame["sma_diff_10_30"] = frame["sma_10"] - frame["sma_30"]
    frame["ema_12"] = close.ewm(span=12, adjust=False).mean()
    frame["ema_26"] = close.ewm(span=26, adjust=False).mean()
    frame["rsi_14"] = _rsi(close, 14)
    frame["macd"] = frame["ema_12"] - frame["ema_26"]
    frame["macd_signal"] = frame["macd"].ewm(span=9, adjust=False).mean()
    frame["macd_hist"] = frame["macd"] - frame["macd_signal"]
    frame["momentum_5"] = close - close.shift(5)
    frame["momentum_10"] = close - close.shift(10)
    frame["rolling_high_20"] = frame["high"].rolling(20).max()
    frame["rolling_low_20"] = frame["low"].rolling(20).min()
    spread = frame["rolling_high_20"] - frame["rolling_low_20"]
    frame["price_position_20"] = (close - frame["rolling_low_20"]) / spread.replace(0, np.nan)
    frame["hour_of_day"] = frame["timestamp"].dt.hour
    frame["day_of_week"] = frame["timestamp"].dt.dayofweek

    if include_target:
        # FX returns are small, so the horizon and BUY/SELL thresholds remain configurable.
        horizon = int(os.getenv("PREDICTION_HORIZON", "3"))
        buy_threshold = float(os.getenv("BUY_THRESHOLD", "0.0003"))
        sell_threshold = float(os.getenv("SELL_THRESHOLD", "-0.0003"))
        frame["future_return"] = close.shift(-horizon) / close - 1
        frame["target"] = np.select(
            [frame["future_return"] > buy_threshold, frame["future_return"] < sell_threshold],
            ["BUY", "SELL"],
            default="HOLD",
        )

    # Rolling indicators need a warm-up window; incomplete rows are not useful training samples.
    required = MODEL_FEATURES + (["future_return", "target"] if include_target else [])
    return frame.dropna(subset=required).reset_index(drop=True)

def time_series_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    # Random shuffling would leak future market behavior into validation and test results.
    train_end = int(len(frame) * 0.70)
    validation_end = int(len(frame) * 0.85)
    train = frame.iloc[:train_end].copy()
    validation = frame.iloc[train_end:validation_end].copy()
    test = frame.iloc[validation_end:].copy()

    return train, validation, test, {
        "trainingRows": len(train),
        "validationRows": len(validation),
        "testRows": len(test),
        "trainDateRange": _date_range(train),
        "validationDateRange": _date_range(validation),
        "testDateRange": _date_range(test),
    }

def _clean_prices(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = frame[["timestamp", "open", "high", "low", "close", "volume"]].copy()
    cleaned["timestamp"] = pd.to_datetime(cleaned["timestamp"], utc=True, errors="coerce")
    for column in ["open", "high", "low", "close", "volume"]:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")
    return cleaned.dropna().sort_values("timestamp").drop_duplicates("timestamp").reset_index(drop=True)

def _rsi(close: pd.Series, periods: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / periods, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / periods, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _date_range(frame: pd.DataFrame) -> dict:
    if frame.empty:
        return {"startDate": None, "endDate": None}
    return {
        "startDate": frame.iloc[0]["timestamp"].isoformat(),
        "endDate": frame.iloc[-1]["timestamp"].isoformat(),
    }