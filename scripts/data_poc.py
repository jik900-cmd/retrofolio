from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any

import requests
import FinanceDataReader as fdr


@dataclass
class PocResult:
    asset_class: str
    symbol: str
    display_name: str
    selected_date: str
    effective_buy_date: str | None
    buy_price: float | None
    current_price: float | None
    chart_points: int
    status: str
    note: str


def _normalize_date(value: Any) -> str:
    if hasattr(value, "date"):
        value = value.date()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def run_fdr_case(symbol: str, display_name: str, asset_class: str, selected_date: str) -> PocResult:
    target = date.fromisoformat(selected_date)
    start = (target - timedelta(days=10)).isoformat()
    end = date.today().isoformat()

    try:
        df = fdr.DataReader(symbol, start, end)
        if df is None or df.empty:
            return PocResult(asset_class, symbol, display_name, selected_date, None, None, None, 0, "error", "No rows returned")

        eligible = df[df.index.date <= target]
        if eligible.empty:
            return PocResult(asset_class, symbol, display_name, selected_date, None, None, None, len(df), "error", "No price on or before selected date")

        buy_row = eligible.iloc[-1]
        effective_buy_date = _normalize_date(eligible.index[-1])
        current_close = df["Close"].dropna()
        if current_close.empty:
            return PocResult(asset_class, symbol, display_name, selected_date, None, None, None, len(df), "error", "No non-null current close price")

        buy_price = float(buy_row["Close"])
        current_price = float(current_close.iloc[-1])
        note = "OK"
        if effective_buy_date != selected_date:
            note = f"Adjusted to prior trading date: {effective_buy_date}"

        return PocResult(
            asset_class=asset_class,
            symbol=symbol,
            display_name=display_name,
            selected_date=selected_date,
            effective_buy_date=effective_buy_date,
            buy_price=buy_price,
            current_price=current_price,
            chart_points=len(df),
            status="ok",
            note=note,
        )
    except Exception as exc:
        return PocResult(asset_class, symbol, display_name, selected_date, None, None, None, 0, "error", repr(exc))


def run_coingecko_case(coin_id: str, symbol: str, display_name: str, selected_date: str) -> PocResult:
    target = date.fromisoformat(selected_date)
    start = (target - timedelta(days=2)).isoformat()
    end = date.today().isoformat()
    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart/range"
    params = {
        "vs_currency": "usd",
        "from": start,
        "to": end,
        "interval": "daily",
    }
    try:
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()
        data = response.json()
        prices = data.get("prices", [])
        if not prices:
            return PocResult("crypto", symbol, display_name, selected_date, None, None, None, 0, "error", "No price rows returned")

        rows: list[tuple[str, float]] = []
        for timestamp_ms, price in prices:
            d = date.fromtimestamp(timestamp_ms / 1000)
            rows.append((d.isoformat(), float(price)))
        rows.sort(key=lambda x: x[0])

        eligible = [row for row in rows if row[0] <= selected_date]
        if not eligible:
            return PocResult("crypto", symbol, display_name, selected_date, None, None, None, len(rows), "error", "No price on or before selected date")

        effective_buy_date, buy_price = eligible[-1]
        current_price = rows[-1][1]
        note = "OK"
        if effective_buy_date != selected_date:
            note = f"Adjusted to prior available date: {effective_buy_date}"

        return PocResult(
            asset_class="crypto",
            symbol=symbol,
            display_name=display_name,
            selected_date=selected_date,
            effective_buy_date=effective_buy_date,
            buy_price=buy_price,
            current_price=current_price,
            chart_points=len(rows),
            status="ok",
            note=note,
        )
    except Exception as exc:
        return run_fdr_case(f"{symbol}/USD", display_name, "crypto", selected_date) if coin_id else PocResult("crypto", symbol, display_name, selected_date, None, None, None, 0, "error", repr(exc))


if __name__ == "__main__":
    results = [
        run_fdr_case("005930", "Samsung Electronics", "kr_stock", "2024-01-02"),
        run_fdr_case("AAPL", "Apple", "us_stock", "2024-01-02"),
        run_coingecko_case("bitcoin", "BTC", "Bitcoin", "2024-01-02"),
    ]

    print(json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2))
