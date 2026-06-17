from __future__ import annotations

import json
import sys

import FinanceDataReader as fdr


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: fetch_kr_stock_series.py <symbol> <startDate> <endDate>")

    raw_symbol, start_date, end_date = sys.argv[1:4]
    symbol = f"YAHOO:{raw_symbol}.KS"
    df = fdr.DataReader(symbol, start_date, end_date)

    points = []
    for index, row in df.iterrows():
        close = row.get("Close")
        if close is None:
            continue

        if hasattr(close, "item"):
            close = close.item()

        if close != close:
            continue

        def to_number(value):
            if value is None:
                return None
            if hasattr(value, "item"):
                value = value.item()
            if value != value:
                return None
            return float(value)

        points.append(
            {
                "date": index.strftime("%Y-%m-%d"),
                "open": to_number(row.get("Open")) or 0.0,
                "high": to_number(row.get("High")) or 0.0,
                "low": to_number(row.get("Low")) or 0.0,
                "close": float(close),
                "volume": to_number(row.get("Volume")),
            }
        )

    print(
        json.dumps(
            {
                "symbol": raw_symbol,
                "startDate": start_date,
                "endDate": end_date,
                "points": points,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
