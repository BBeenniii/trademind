from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
from .dataset_metadata import build_metadata
from .histdata_parser import NORMALIZED_COLUMNS, parse_market_csv
from .preprocessing import TIMEFRAME_RULES, resample_ohlcv

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_PATH = PROCESSED_DIR / "dataset_metadata.json"

def process_raw_dataset() -> dict:
    # Raw vendor downloads stay separate from generated files so they can be replaced or ignored cleanly.
    raw_files = sorted(RAW_DIR.rglob("*.csv"))
    if not raw_files:
        raise FileNotFoundError(f"No CSV files found under {RAW_DIR}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    frames: list[pd.DataFrame] = []
    invalid_rows_removed = 0
    for path in raw_files:
        frame, invalid_rows = parse_market_csv(path)
        frames.append(frame)
        invalid_rows_removed += invalid_rows

    combined = pd.concat(frames, ignore_index=True).sort_values("timestamp")
    # Overlapping downloads can repeat a minute; the later source occurrence wins.
    duplicate_rows_removed = int(combined.duplicated(subset=["timestamp"]).sum())
    combined = combined.drop_duplicates(subset=["timestamp"], keep="last").reset_index(drop=True)

    one_minute_path = _processed_path("1m")
    _write_processed(combined, one_minute_path)
    for timeframe in ["5m", "15m"]:
        _write_processed(resample_ohlcv(combined, timeframe), _processed_path(timeframe))

    metadata = build_metadata(
        combined,
        one_minute_path,
        raw_files,
        duplicate_rows_removed,
        invalid_rows_removed,
    )
    metadata["resampledFiles"] = {
        timeframe: str(_processed_path(timeframe))
        for timeframe in TIMEFRAME_RULES
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata

def load_market_dataset(timeframe: str = "5m", allow_process: bool = False) -> pd.DataFrame | None:
    path = _processed_path(timeframe)
    if not path.exists() and allow_process and any(RAW_DIR.rglob("*.csv")):
        process_raw_dataset()
    if not path.exists():
        return None

    frame = pd.read_csv(path)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    return frame[NORMALIZED_COLUMNS]

def get_dataset_metadata() -> dict | None:
    if not METADATA_PATH.exists():
        return None
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))

def dataset_status() -> dict:
    metadata = get_dataset_metadata()
    raw_files = sorted(RAW_DIR.rglob("*.csv"))
    return {
        "rawDatasetDetected": bool(raw_files),
        "processedDatasetExists": metadata is not None,
        "activeSource": "REAL_HISTDATA" if metadata else "MOCK_SAMPLE",
        "rawFileCount": len(raw_files),
        "availableTimeframes": [
            timeframe
            for timeframe in TIMEFRAME_RULES
            if _processed_path(timeframe).exists()
        ],
        "metadata": metadata,
    }

def _processed_path(timeframe: str) -> Path:
    if timeframe not in TIMEFRAME_RULES:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    return PROCESSED_DIR / f"eurusd_{timeframe}_processed.csv"

def _write_processed(frame: pd.DataFrame, path: Path) -> None:
    output = frame.copy()
    output["timestamp"] = output["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    output.to_csv(path, index=False)