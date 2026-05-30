from __future__ import annotations
import csv
from pathlib import Path
import pandas as pd

NORMALIZED_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]

def parse_market_csv(path: Path) -> tuple[pd.DataFrame, int]:
    # HistData exports vary between MetaTrader downloads, so accept headered and headerless layouts.
    delimiter = _detect_delimiter(path)
    first_row = _first_row(path, delimiter)
    has_header = _looks_like_header(first_row)

    if has_header:
        frame = pd.read_csv(path, sep=delimiter)
        frame.columns = [str(column).strip().lower() for column in frame.columns]
        frame = _normalize_headered(frame)
    else:
        frame = pd.read_csv(path, sep=delimiter, header=None)
        frame = _normalize_headerless(frame)

    before = len(frame)
    frame = _clean_rows(frame)
    return frame, before - len(frame)

def _normalize_headered(frame: pd.DataFrame) -> pd.DataFrame:
    columns = {column.replace(" ", "").replace("_", ""): column for column in frame.columns}
    date_column = columns.get("date")
    time_column = columns.get("time")
    timestamp_column = columns.get("timestamp") or columns.get("datetime")

    if timestamp_column:
        timestamp = frame[timestamp_column]
    elif date_column and time_column:
        timestamp = frame[date_column].astype(str) + " " + frame[time_column].astype(str)
    else:
        timestamp = frame.iloc[:, 0].astype(str)

    return pd.DataFrame(
        {
            "timestamp": timestamp,
            "open": frame[columns.get("open", "open")],
            "high": frame[columns.get("high", "high")],
            "low": frame[columns.get("low", "low")],
            "close": frame[columns.get("close", "close")],
            "volume": frame[columns["volume"]] if "volume" in columns else 0,
        }
    )

def _normalize_headerless(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.shape[1] >= 7:
        timestamp = frame.iloc[:, 0].astype(str) + " " + frame.iloc[:, 1].astype(str)
        values = frame.iloc[:, 2:7].copy()
    elif frame.shape[1] >= 6:
        timestamp = frame.iloc[:, 0]
        values = frame.iloc[:, 1:6].copy()
    else:
        raise ValueError(f"Unsupported market CSV layout with {frame.shape[1]} columns")

    values.columns = ["open", "high", "low", "close", "volume"]
    values.insert(0, "timestamp", timestamp)
    return values

def _clean_rows(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = frame[NORMALIZED_COLUMNS].copy()
    # UTC normalization lets yearly source files merge without local-time ambiguity.
    cleaned["timestamp"] = pd.to_datetime(cleaned["timestamp"], utc=True, errors="coerce")
    for column in ["open", "high", "low", "close", "volume"]:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")
    cleaned["volume"] = cleaned["volume"].fillna(0)
    cleaned = cleaned.dropna(subset=["timestamp", "open", "high", "low", "close"])
    cleaned = cleaned[(cleaned[["open", "high", "low", "close"]] > 0).all(axis=1)]
    return cleaned.sort_values("timestamp").reset_index(drop=True)

def _detect_delimiter(path: Path) -> str:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        sample = handle.read(4096)
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
    except csv.Error:
        return ","

def _first_row(path: Path, delimiter: str) -> list[str]:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        return next(csv.reader(handle, delimiter=delimiter))

def _looks_like_header(row: list[str]) -> bool:
    lowered = {value.strip().lower() for value in row}
    return bool(lowered.intersection({"timestamp", "datetime", "date", "open", "high", "close"}))