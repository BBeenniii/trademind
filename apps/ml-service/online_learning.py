from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
import joblib

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "river_online.joblib"
STATUS_PATH = MODEL_DIR / "river_online_status.json"

try:
    from river import linear_model, preprocessing
except ImportError:
    linear_model = None
    preprocessing = None

def update_online_learner(feedback_records: list[dict]) -> dict:
    if linear_model is None or preprocessing is None:
        raise RuntimeError("River is not installed. Run pip install -r requirements.txt.")

    model, status = _load_state()
    history = status.get("recentHits", [])
    for record in feedback_records:
        # Score before learning so the rolling metric reflects unseen feedback.
        target = 1 if record.get("outcome") == "WIN" else 0
        features = _feedback_features(record)
        prediction = model.predict_one(features)
        if prediction is not None:
            history.append(int(prediction == target))
        model.learn_one(features, target)

    history = history[-100:]
    status = {
        "modelType": "RIVER_ONLINE",
        "recordsProcessed": status.get("recordsProcessed", 0) + len(feedback_records),
        "rollingAccuracy": round(sum(history) / len(history), 4) if history else 0.0,
        "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
        "recentHits": history,
        "message": "Online learner updated from feedback records.",
    }
    joblib.dump(model, MODEL_PATH)
    STATUS_PATH.write_text(json.dumps(status, indent=2), encoding="utf-8")
    return _public_status(status)

def online_status() -> dict:
    _, status = _load_state()
    return _public_status(status)

def _load_state():
    MODEL_DIR.mkdir(exist_ok=True)
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
    else:
        if linear_model is None or preprocessing is None:
            return None, _empty_status()
        # River stays an experimental side learner; it never replaces the champion automatically.
        model = preprocessing.StandardScaler() | linear_model.LogisticRegression()
    status = json.loads(STATUS_PATH.read_text(encoding="utf-8")) if STATUS_PATH.exists() else _empty_status()
    return model, status

def _feedback_features(record: dict) -> dict:
    return {
        "confidence": float(record.get("confidence") or 0),
        "close_price": float(record.get("closePrice") or 0),
        "rsi": float(record.get("rsi") or 50),
        "sma_spread": float(record.get("smaFast") or 0) - float(record.get("smaSlow") or 0),
        "volatility": float(record.get("volatility") or 0),
        "momentum": float(record.get("momentum") or 0),
        "return_pct": float(record.get("returnPct") or 0),
        "is_buy": 1.0 if record.get("signal") == "BUY" else 0.0,
        "is_sell": 1.0 if record.get("signal") == "SELL" else 0.0,
    }

def _empty_status() -> dict:
    return {
        "modelType": "RIVER_ONLINE",
        "recordsProcessed": 0,
        "rollingAccuracy": 0.0,
        "lastUpdatedAt": None,
        "recentHits": [],
    }

def _public_status(status: dict) -> dict:
    return {key: value for key, value in status.items() if key != "recentHits"}