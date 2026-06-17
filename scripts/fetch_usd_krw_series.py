from __future__ import annotations

import json
import sys

import FinanceDataReader as fdr


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: fetch_usd_krw_series.py <startDate> <endDate>")

    start_date, end_date = sys.argv[1:3]
    df = fdr.DataReader("USD/KRW", start_date, end_date)

    points = []
    for index, row in df.iterrows():
        close = row.get("Close")
        if close is None:
            continue
        if hasattr(close, "item"):
            close = close.item()
        if close != close:
            continue
        points.append({
            "date": index.strftime("%Y-%m-%d"),
            "close": float(close),
        })

    print(json.dumps({"points": points}, ensure_ascii=False))


if __name__ == "__main__":
    main()
