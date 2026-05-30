from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import TimeSeriesSplit
from datasets import load_market_dataset
from feature_engineering import MODEL_FEATURES, engineer_market_features

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

FEATURES = ["sma_diff", "rsi", "volatility", "return_pct", "momentum"]
# This threshold creates research signals only; it is not a trading recommendation.
SIGNAL_THRESHOLD = 0.58

@dataclass
class TrainResult:
    model_path: Path
    trained_rows: int
    test_rows: int
    test_accuracy: float

def load_prices(pair: str = "EURUSD", timeframe: str | None = None, prefer_real: bool = True) -> pd.DataFrame:
    timeframe = timeframe or os.getenv("TRAINING_TIMEFRAME", "5m")
    # Prefer processed HistData, but keep a self-contained mock fallback for first-run demos.
    if prefer_real:
        real_prices = load_market_dataset(timeframe)
        if real_prices is not None:
            return _clean_price_frame(real_prices)

    csv_path = DATA_DIR / f"{pair.lower()}_sample.csv"
    if csv_path.exists():
        frame = pd.read_csv(csv_path)
        if len(frame) >= 120:
            return _clean_price_frame(frame)

    return _mock_fx_prices(pair)

def prepare_market_frame(prices: pd.DataFrame) -> pd.DataFrame:
    frame = _clean_price_frame(prices).copy()
    frame["return_pct"] = frame["close"].pct_change()
    frame["sma_fast"] = frame["close"].rolling(10).mean()
    frame["sma_slow"] = frame["close"].rolling(30).mean()
    frame["sma_diff"] = frame["sma_fast"] - frame["sma_slow"]
    frame["momentum"] = frame["close"] - frame["close"].shift(5)
    frame["volatility"] = frame["return_pct"].rolling(14).std()
    frame["rsi"] = _rsi(frame["close"], periods=14)
    frame["next_up"] = (frame["close"].shift(-1) > frame["close"]).astype(int)
    return frame.dropna().reset_index(drop=True)

def train_signal_model(pair: str = "EURUSD") -> TrainResult:
    frame = prepare_market_frame(load_prices(pair))
    train_frame = frame.iloc[:-1].copy()
    X = train_frame[FEATURES]
    y = train_frame["next_up"]

    # Time-aware folds prevent future candles from leaking into baseline evaluation.
    split = TimeSeriesSplit(n_splits=4)
    train_index, test_index = list(split.split(X))[-1]
    X_train, X_test = X.iloc[train_index], X.iloc[test_index]
    y_train, y_test = y.iloc[train_index], y.iloc[test_index]

    model = RandomForestClassifier(
        n_estimators=140,
        max_depth=6,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X_train, y_train)
    accuracy = accuracy_score(y_test, model.predict(X_test))

    model_path = _model_path(pair)
    joblib.dump(model, model_path)
    return TrainResult(
        model_path=model_path,
        trained_rows=len(X_train),
        test_rows=len(X_test),
        test_accuracy=round(float(accuracy), 4),
    )

def ensure_signal_model(pair: str = "EURUSD") -> Path:
    model_path = _model_path(pair)
    if not model_path.exists():
        train_signal_model(pair)
    return model_path

def predict_latest_signal(pair: str = "EURUSD", model_version: str | None = None) -> dict:
    artifact = _load_signal_model(pair, model_version)
    latest, probabilities = _latest_prediction(artifact, load_prices(pair))
    signal, confidence = _signal_from_probabilities(probabilities)

    return {
        "pair": pair,
        "timestamp": latest["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "signal": signal,
        "confidence": confidence,
        "closePrice": round(float(latest["close"]), 5),
        "features": _signal_features(latest),
        "reason": _signal_reason(signal, latest, probabilities),
    }

def predict_live_signal(pair: str, candles: list[dict], model_version: str | None = None) -> dict:
    artifact = _load_signal_model(pair, model_version)
    live_frame = pd.DataFrame(candles)
    if live_frame.empty:
        live_frame = load_prices(pair).tail(120)
    else:
        live_frame = _normalize_live_candles(live_frame)
        if len(live_frame) < 80:
            # Rolling indicators still need enough history immediately after a live feed starts.
            history = load_prices(pair).tail(120)
            live_frame = pd.concat([history, live_frame], ignore_index=True)

    latest, probabilities = _latest_prediction(artifact, live_frame)
    signal, confidence = _signal_from_probabilities(probabilities)

    return {
        "pair": pair,
        "timestamp": latest["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "signal": signal,
        "confidence": confidence,
        "closePrice": round(float(latest["close"]), 5),
        "features": _signal_features(latest),
        "reason": _signal_reason(signal, latest, probabilities),
    }

def run_backtest(pair: str = "EURUSD") -> dict:
    # Backtest results are illustrative research metrics, not evidence of future profitability.
    model = joblib.load(ensure_signal_model(pair))
    frame = prepare_market_frame(load_prices(pair))
    frame = frame.iloc[-260:].copy().reset_index(drop=True)

    balance = 10_000.0
    position = None
    entry_price = 0.0
    entry_time = None
    entry_balance = balance
    position_size = 0.3
    trades: list[dict] = []
    equity_curve: list[dict] = []

    for _, row in frame.iterrows():
        probabilities = _class_probabilities(model, row[FEATURES])
        signal, confidence = _signal_from_probabilities(probabilities)

        if position and (signal == "HOLD" or signal != position):
            pnl, pnl_percent = _close_position(
                direction=position,
                entry_price=entry_price,
                exit_price=float(row["close"]),
                entry_balance=entry_balance,
                position_size=position_size,
            )
            balance += pnl
            trades.append(
                {
                    "pair": pair,
                    "entryTime": entry_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "exitTime": row["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "direction": position,
                    "entryPrice": round(entry_price, 5),
                    "exitPrice": round(float(row["close"]), 5),
                    "pnl": round(float(pnl), 2),
                    "pnlPercent": round(float(pnl_percent), 4),
                }
            )
            position = None

        if signal in {"BUY", "SELL"} and not position:
            position = signal
            entry_price = float(row["close"])
            entry_time = row["timestamp"]
            entry_balance = balance

        equity = balance
        if position:
            unrealized, _ = _close_position(
                direction=position,
                entry_price=entry_price,
                exit_price=float(row["close"]),
                entry_balance=entry_balance,
                position_size=position_size,
            )
            equity = balance + unrealized

        equity_curve.append(
            {
                "timestamp": row["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                "equity": round(float(equity), 2),
                "close": round(float(row["close"]), 5),
                "signal": signal,
                "confidence": confidence,
            }
        )

    if position:
        row = frame.iloc[-1]
        pnl, pnl_percent = _close_position(
            direction=position,
            entry_price=entry_price,
            exit_price=float(row["close"]),
            entry_balance=entry_balance,
            position_size=position_size,
        )
        balance += pnl
        trades.append(
            {
                "pair": pair,
                "entryTime": entry_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "exitTime": row["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                "direction": position,
                "entryPrice": round(entry_price, 5),
                "exitPrice": round(float(row["close"]), 5),
                "pnl": round(float(pnl), 2),
                "pnlPercent": round(float(pnl_percent), 4),
            }
        )
        equity_curve[-1]["equity"] = round(float(balance), 2)

    equity_values = np.array([point["equity"] for point in equity_curve])
    peak = np.maximum.accumulate(equity_values)
    drawdowns = (equity_values - peak) / peak
    trade_returns = [trade["pnlPercent"] for trade in trades]
    winning_trades = [trade for trade in trades if (trade["pnl"] or 0) > 0]

    drawdown_curve = [
        {"timestamp": point["timestamp"], "drawdown": round(float(drawdowns[index]), 4)}
        for index, point in enumerate(equity_curve)
    ]

    return {
        "pair": pair,
        "startDate": frame.iloc[0]["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDate": frame.iloc[-1]["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metrics": {
            "initialBalance": 10000.0,
            "finalBalance": round(float(balance), 2),
            "totalReturn": round(float((balance - 10000.0) / 10000.0), 4),
            "winRate": round(float(len(winning_trades) / len(trades)), 4) if trades else 0.0,
            "maxDrawdown": round(float(drawdowns.min()), 4) if len(drawdowns) else 0.0,
            "tradeCount": len(trades),
            "averageTradeReturn": round(float(np.mean(trade_returns)), 4) if trade_returns else 0.0,
            "bestTrade": round(float(max(trade_returns)), 4) if trade_returns else 0.0,
            "worstTrade": round(float(min(trade_returns)), 4) if trade_returns else 0.0,
        },
        "trades": trades[-80:],
        "equityCurve": equity_curve,
        "drawdown": drawdown_curve,
    }

def retrain_signal_model(version: str, feedback_records: list[dict], pair: str = "EURUSD") -> dict:
    from model_registry import train_registered_model

    result = train_registered_model("RANDOM_FOREST", os.getenv("TRAINING_TIMEFRAME", "5m"), version)
    return {
        "version": version,
        "artifactPath": result["artifactPath"],
        "trainingSamples": result["split"]["trainingRows"],
        "validationSamples": result["split"]["validationRows"],
        "testRows": result["split"]["testRows"],
        "metrics": result["metrics"],
        "dataset": result["dataset"],
        "split": result["split"],
        "featureImportance": result["featureImportance"],
        "trainingTimeSeconds": result["trainingTimeSeconds"],
    }

def evaluate_feedback_model(version: str, feedback_records: list[dict]) -> dict:
    pnl_values = [float(record.get("pnl") or 0) for record in feedback_records]
    pnl_returns = [float(record.get("pnlPercent") or 0) for record in feedback_records]
    wins = [record for record in feedback_records if record.get("outcome") == "WIN"]
    gains = sum(value for value in pnl_values if value > 0)
    losses = abs(sum(value for value in pnl_values if value < 0))
    cumulative = np.cumsum(pnl_returns)
    peaks = np.maximum.accumulate(np.r_[0.0, cumulative])
    drawdowns = np.r_[0.0, cumulative] - peaks

    return {
        "version": version,
        "winRate": round(float(len(wins) / len(feedback_records)), 4) if feedback_records else 0.0,
        "avgPnl": round(float(np.mean(pnl_values)), 4) if pnl_values else 0.0,
        "profitFactor": round(float(gains / losses), 4) if losses else 0.0,
        "maxDrawdown": round(float(abs(drawdowns.min())), 4) if len(drawdowns) else 0.0,
    }

def _clean_price_frame(frame: pd.DataFrame) -> pd.DataFrame:
    required = ["timestamp", "open", "high", "low", "close", "volume"]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")

    cleaned = frame[required].copy()
    cleaned["timestamp"] = pd.to_datetime(cleaned["timestamp"], utc=True).dt.tz_convert(None)
    for column in ["open", "high", "low", "close", "volume"]:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")
    return cleaned.dropna().sort_values("timestamp").reset_index(drop=True)

def _normalize_live_candles(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy()
    if "volume" not in normalized.columns:
        normalized["volume"] = 0
    return _clean_price_frame(normalized)

def _mock_fx_prices(pair: str) -> pd.DataFrame:
    rng = np.random.default_rng(11)
    periods = 460
    timestamps = pd.date_range("2024-01-01", periods=periods, freq="4h")

    drift = np.linspace(0, 0.016, periods)
    cycle = np.sin(np.linspace(0, 16 * np.pi, periods)) * 0.006
    noise = rng.normal(0, 0.0018, periods).cumsum()
    close = 1.085 + drift + cycle + noise
    open_ = np.r_[close[0], close[:-1]] + rng.normal(0, 0.0008, periods)
    high = np.maximum(open_, close) + rng.uniform(0.0004, 0.0022, periods)
    low = np.minimum(open_, close) - rng.uniform(0.0004, 0.0022, periods)
    volume = rng.integers(900, 4200, periods)

    return pd.DataFrame(
        {
            "timestamp": timestamps.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "open": np.round(open_, 5),
            "high": np.round(high, 5),
            "low": np.round(low, 5),
            "close": np.round(close, 5),
            "volume": volume,
        }
    )

def _rsi(close: pd.Series, periods: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / periods, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / periods, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _class_probabilities(model, features: pd.Series, feature_names: list[str] = FEATURES, class_labels: dict | None = None) -> dict[str, float]:
    probabilities = model.predict_proba(pd.DataFrame([features], columns=feature_names))[0]
    by_class = {
        str(class_labels.get(int(label), label) if class_labels else label).upper(): float(probabilities[index])
        for index, label in enumerate(model.classes_)
    }
    if "0" in by_class or "1" in by_class:
        return {"sell": by_class.get("0", 0.0), "buy": by_class.get("1", 0.0), "hold": 0.0}
    return {"sell": by_class.get("SELL", 0.0), "buy": by_class.get("BUY", 0.0), "hold": by_class.get("HOLD", 0.0)}

def _signal_from_probabilities(probabilities: dict[str, float]) -> tuple[str, float]:
    buy_probability = probabilities["buy"]
    sell_probability = probabilities["sell"]
    if buy_probability >= SIGNAL_THRESHOLD:
        return "BUY", round(float(buy_probability), 4)
    if sell_probability >= SIGNAL_THRESHOLD:
        return "SELL", round(float(sell_probability), 4)
    return "HOLD", round(float(max(buy_probability, sell_probability, probabilities.get("hold", 0.0))), 4)

def _signal_reason(signal: str, row: pd.Series, probabilities: dict[str, float]) -> str:
    sma_fast = _row_value(row, "sma_fast", "sma_10")
    sma_slow = _row_value(row, "sma_slow", "sma_30")
    sma_state = "above" if sma_fast > sma_slow else "below"
    rsi = _row_value(row, "rsi", "rsi_14")
    volatility = _row_value(row, "volatility", "volatility_10")
    if signal == "BUY":
        return (
            f"SMA 10 is {sma_state} SMA 30 and the model assigns "
            f"{probabilities['buy']:.0%} probability to the next candle moving higher."
        )
    if signal == "SELL":
        return (
            f"SMA 10 is {sma_state} SMA 30 and the model assigns "
            f"{probabilities['sell']:.0%} probability to the next candle moving lower."
        )
    return f"Model probabilities are balanced with RSI at {rsi:.1f} and volatility near {volatility:.4f}."

def _close_position(
    direction: str,
    entry_price: float,
    exit_price: float,
    entry_balance: float,
    position_size: float,
) -> tuple[float, float]:
    raw_return = (exit_price - entry_price) / entry_price
    signed_return = raw_return if direction == "BUY" else -raw_return
    pnl = entry_balance * position_size * signed_return
    return pnl, signed_return

def _feedback_training_frame(feedback_records: list[dict]) -> pd.DataFrame:
    rows = []
    for record in feedback_records:
        label = _feedback_label(record)
        if label is None:
            continue

        sma_fast = float(record.get("smaFast") or record.get("closePrice") or 0)
        sma_slow = float(record.get("smaSlow") or record.get("closePrice") or 0)
        rows.append(
            {
                "sma_diff": sma_fast - sma_slow,
                "rsi": float(record.get("rsi") or 50),
                "volatility": float(record.get("volatility") or 0),
                "return_pct": float(record.get("returnPct") or 0),
                "momentum": float(record.get("momentum") or 0),
                "next_up": label,
            }
        )

    return pd.DataFrame(rows, columns=FEATURES + ["next_up"])

def _feedback_label(record: dict) -> int | None:
    signal = record.get("signal")
    outcome = record.get("outcome")
    if signal == "BUY" and outcome == "WIN":
        return 1
    if signal == "BUY" and outcome == "LOSS":
        return 0
    if signal == "SELL" and outcome == "WIN":
        return 0
    if signal == "SELL" and outcome == "LOSS":
        return 1
    return None

def _load_signal_model(pair: str, model_version: str | None = None) -> RandomForestClassifier:
    if model_version:
        from model_registry import load_versioned_model

        artifact = load_versioned_model(model_version)
        if artifact is not None:
            return artifact
    return joblib.load(ensure_signal_model(pair))

def _latest_prediction(artifact, prices: pd.DataFrame) -> tuple[pd.Series, dict[str, float]]:
    if isinstance(artifact, dict) and "model" in artifact:
        frame = engineer_market_features(prices, include_target=False)
        if frame.empty:
            raise ValueError("Not enough candle history for advanced live prediction")
        latest = frame.iloc[-1]
        feature_names = artifact.get("features", MODEL_FEATURES)
        return latest, _class_probabilities(artifact["model"], latest[feature_names], feature_names, artifact.get("classLabels"))

    frame = prepare_market_frame(prices).tail(1)
    if frame.empty:
        raise ValueError("Not enough candle history for live prediction")
    latest = frame.iloc[-1]
    return latest, _class_probabilities(artifact, latest[FEATURES])

def _signal_features(row: pd.Series) -> dict:
    return {
        "rsi": round(_row_value(row, "rsi", "rsi_14"), 2),
        "smaFast": round(_row_value(row, "sma_fast", "sma_10"), 5),
        "smaSlow": round(_row_value(row, "sma_slow", "sma_30"), 5),
        "volatility": round(_row_value(row, "volatility", "volatility_10"), 6),
        "returnPct": round(_row_value(row, "return_pct", "return_1"), 6),
        "momentum": round(_row_value(row, "momentum", "momentum_5"), 6),
    }

def _row_value(row: pd.Series, *names: str) -> float:
    for name in names:
        if name in row:
            return float(row[name])
    return 0.0

def _new_model() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=140,
        max_depth=6,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
    )

def _model_path(pair: str) -> Path:
    return MODEL_DIR / f"{pair.lower()}_random_forest.joblib"

def _version_model_path(version: str) -> Path:
    safe_version = "".join(character for character in version if character.isalnum() or character in {"-", "_"})
    return MODEL_DIR / f"model_{safe_version}.joblib"

def _version_metadata_path(version: str) -> Path:
    model_path = _version_model_path(version)
    return model_path.with_name(f"{model_path.stem}_meta.json")