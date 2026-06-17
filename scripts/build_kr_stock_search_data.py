from __future__ import annotations

import json
from pathlib import Path

import FinanceDataReader as fdr
import pandas as pd


def load_market(market: str) -> pd.DataFrame:
    df = fdr.StockListing(market)
    keep = df[["Code", "Name", "Market"]].copy()
    keep = keep.dropna(subset=["Code", "Name"])
    keep["Code"] = keep["Code"].astype(str).str.zfill(6)
    keep["Name"] = keep["Name"].astype(str).str.strip()
    keep = keep[keep["Code"].str.match(r"^\d{6}$")]
    keep = keep[keep["Name"] != ""]
    return keep


def main() -> None:
    kospi = load_market("KOSPI")
    kosdaq = load_market("KOSDAQ")
    merged = pd.concat([kospi, kosdaq], ignore_index=True)
    merged = merged.drop_duplicates(subset=["Code"])
    merged = merged.sort_values(["Market", "Name", "Code"]).reset_index(drop=True)

    items = []
    for _, row in merged.iterrows():
        code = row["Code"]
        name = row["Name"]
        market = row["Market"]
        items.append(
            {
                "assetClass": "kr_stock",
                "name": name,
                "symbol": code,
                "keywords": [name, code, market],
            }
        )

    out_path = Path("src/lib/kr-stock-search-data.generated.json")
    out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(items)} items to {out_path}")


if __name__ == "__main__":
    main()
