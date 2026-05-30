from __future__ import annotations
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from datasets import dataset_status, load_market_dataset
from feature_engineering import MODEL_FEATURES, engineer_market_features, time_series_split

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)
LABELS = ["BUY", "SELL", "HOLD"]

try:
    from lightgbm import LGBMClassifier
except ImportError:
    LGBMClassifier = None

try:
    from xgboost import XGBClassifier
except ImportError:
    XGBClassifier = None

def train_registered_model(model_type: str, timeframe: str = "5m", version: str | None = None) -> dict:
    normalized_type = model_type.upper()
    model = _new_model(normalized_type)
    version = version or _new_version(normalized_type)
    prices = _training_prices(timeframe)
    features = engineer_market_features(prices)
    # Keep local retraining practical while favoring the most recent market regime.
    max_rows = int(os.getenv("MODEL_TRAINING_MAX_ROWS", "180000"))
    if len(features) > max_rows:
        features = features.tail(max_rows).reset_index(drop=True)

    train, validation, test, split = time_series_split(features)
    if min(len(train), len(validation), len(test)) == 0:
        raise ValueError("Not enough processed market data for a time-based split")

    started = time.perf_counter()
    class_labels = None
    if normalized_type == "XGBOOST":
        label_ids = {label: index for index, label in enumerate(LABELS)}
        class_labels = {index: label for label, index in label_ids.items()}
        model.fit(train[MODEL_FEATURES], train["target"].map(label_ids))
        predictions = np.array([class_labels[int(value)] for value in model.predict(test[MODEL_FEATURES])])
    else:
        model.fit(train[MODEL_FEATURES], train["target"])
        predictions = model.predict(test[MODEL_FEATURES])
    training_seconds = round(time.perf_counter() - started, 3)
    metrics = _classification_metrics(test["target"], predictions)
    class_distribution = train["target"].value_counts().reindex(LABELS, fill_value=0).to_dict()
    feature_importance = _feature_importance(model)
    source = dataset_status()["activeSource"]
    artifact_path = _artifact_path(version)
    bundle = {
        "model": model,
        "features": MODEL_FEATURES,
        "modelType": normalized_type,
        "timeframe": timeframe,
        "classLabels": class_labels,
    }
    # Artifacts are generated locally and ignored by Git; model binaries do not belong in the repo.
    joblib.dump(bundle, artifact_path)

    result = {
        "modelType": normalized_type,
        "version": version,
        "artifactPath": f"models/{artifact_path.name}",
        "metrics": {**metrics, "classDistribution": class_distribution},
        "dataset": {
            "source": source,
            "timeframe": timeframe,
            "rowCount": len(prices),
            "startDate": prices.iloc[0]["timestamp"].isoformat(),
            "endDate": prices.iloc[-1]["timestamp"].isoformat(),
        },
        "split": split,
        "featureImportance": feature_importance,
        "trainingTimeSeconds": training_seconds,
        "notes": _imbalance_note(class_distribution),
    }
    _metadata_path(version).write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result

def compare_models(timeframe: str = "5m", include_xgboost: bool = False) -> dict:
    model_types = ["RANDOM_FOREST", "LIGHTGBM"]
    if include_xgboost:
        model_types.append("XGBOOST")

    results = []
    errors = []
    for model_type in model_types:
        try:
            results.append(train_registered_model(model_type, timeframe))
        except Exception as exc:
            errors.append({"modelType": model_type, "message": str(exc)})
    return {"timeframe": timeframe, "models": results, "errors": errors}

def get_feature_importance(version: str) -> list[dict]:
    path = _metadata_path(version)
    if not path.exists():
        return []
    metadata = json.loads(path.read_text(encoding="utf-8"))
    return metadata.get("featureImportance", [])

def load_versioned_model(version: str):
    path = _artifact_path(version)
    return joblib.load(path) if path.exists() else None

def _training_prices(timeframe: str):
    prices = load_market_dataset(timeframe)
    if prices is None:
        from market_pipeline import load_prices

        prices = load_prices("EURUSD", timeframe=timeframe, prefer_real=False)
    return prices

def _new_model(model_type: str):
    if model_type == "RANDOM_FOREST":
        # RandomForest is the understandable baseline for the portfolio workflow.
        return RandomForestClassifier(
            n_estimators=140,
            max_depth=8,
            min_samples_leaf=4,
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=42,
        )
    if model_type == "LIGHTGBM":
        if LGBMClassifier is None:
            raise RuntimeError("LightGBM is not installed. Run pip install -r requirements.txt.")
        # LightGBM is the stronger tabular challenger, still evaluated against the same split.
        return LGBMClassifier(
            n_estimators=300,
            learning_rate=0.03,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            class_weight="balanced",
            verbosity=-1,
            random_state=42,
        )
    if model_type == "XGBOOST":
        if XGBClassifier is None:
            raise RuntimeError("XGBoost is optional and is not installed.")
        return XGBClassifier(
            n_estimators=240,
            learning_rate=0.03,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            n_jobs=-1,
            random_state=42,
        )
    raise ValueError(f"Unsupported model type: {model_type}")

def _classification_metrics(actual, predicted) -> dict:
    precision, recall, f1, _ = precision_recall_fscore_support(actual, predicted, labels=LABELS, zero_division=0)
    weighted = precision_recall_fscore_support(actual, predicted, average="weighted", zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(actual, predicted)), 4),
        "precision": round(float(weighted[0]), 4),
        "recall": round(float(weighted[1]), 4),
        "f1Score": round(float(weighted[2]), 4),
        "classPrecision": {
            label: round(float(value), 4)
            for label, value in zip(LABELS, precision)
        },
    }

def _feature_importance(model) -> list[dict]:
    values = getattr(model, "feature_importances_", None)
    if values is None:
        return []
    ranked = sorted(
        [{"feature": feature, "importance": round(float(value), 6)} for feature, value in zip(MODEL_FEATURES, values)],
        key=lambda item: item["importance"],
        reverse=True,
    )
    return ranked

def _imbalance_note(distribution: dict) -> str | None:
    # HOLD-heavy labels can make accuracy look better than directional precision really is.
    values = list(distribution.values())
    if not values or max(values) == 0:
        return None
    return "Class imbalance is high; review directional precision alongside accuracy." if min(values) / max(values) < 0.25 else None

def _new_version(model_type: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"v4-{model_type.lower().replace('_', '-')}-{stamp}"

def _artifact_path(version: str) -> Path:
    return MODEL_DIR / f"model_{_safe_version(version)}.joblib"

def _metadata_path(version: str) -> Path:
    return MODEL_DIR / f"model_{_safe_version(version)}_meta.json"

def _safe_version(version: str) -> str:
    return "".join(character for character in version if character.isalnum() or character in {"-", "_"})