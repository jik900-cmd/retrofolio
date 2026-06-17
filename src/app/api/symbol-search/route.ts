import { NextResponse } from "next/server";

import type { AssetClass } from "@/lib/supported-assets";
import { SYMBOL_SEARCH_DATA } from "@/lib/symbol-search-data";
import KR_STOCK_SEARCH_DATA from "@/lib/kr-stock-search-data.generated.json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass") as AssetClass | null;
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!assetClass) {
    return NextResponse.json({ message: "assetClass is required.", results: [] }, { status: 400 });
  }

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const data = assetClass === "kr_stock" ? KR_STOCK_SEARCH_DATA : SYMBOL_SEARCH_DATA.filter((item) => item.assetClass === assetClass);

  const results = data.filter((item) => item.assetClass === assetClass)
    .filter((item) => {
      const haystacks = [item.name, item.symbol, ...item.keywords].map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(q));
    })
    .slice(0, 8)
    .map((item) => ({
      name: item.name,
      symbol: item.symbol,
      assetClass: item.assetClass,
    }));

  return NextResponse.json({ results });
}
