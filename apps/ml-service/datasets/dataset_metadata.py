from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd

def build_metadata(
    frame: pd.DataFrame,
    processed_path: Path,
    raw_files: list[Path],
    duplicate_rows_removed: int,
    invalid_rows_removed: int,
) -> dict:
    # This is a diagnostic gap estimate, not a market-hours completeness guarantee.
    differences = frame["timestamp"].sort_values().diff().dropna().dt.total_seconds().div(60)
    missing_rows = int(differences[differences > 1].sub(1).sum())
    years = sorted({int(year) for year in frame["timestamp"].dt.year.unique()})
    return {
        "source": "HISTDATA_MT4_MT5",
        "pair": "EURUSD",
        "timeframe": "1m",
        "rowCount": len(frame),
        "startDate": frame.iloc[0]["timestamp"].isoformat(),
        "endDate": frame.iloc[-1]["timestamp"].isoformat(),
        "yearsIncluded": years,
        "missingRowsEstimate": missing_rows,
        "duplicateRowsRemoved": duplicate_rows_removed,
        "invalidRowsRemoved": invalid_rows_removed,
        "processedFilePath": str(processed_path),
        "rawFiles": [str(path) for path in raw_files],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }