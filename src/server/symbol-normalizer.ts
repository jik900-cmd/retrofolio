import type { AssetClass } from "@/lib/supported-assets";

export type NormalizedSymbol = {
  assetClass: AssetClass;
  rawSymbol: string;
  normalizedSymbol: string;
  currency: "KRW" | "USD";
};

export function normalizeSymbol(assetClass: AssetClass, rawSymbol: string): NormalizedSymbol {
  const trimmed = rawSymbol.trim();

  if (!trimmed) {
    throw new Error(getSymbolFormatMessage(assetClass));
  }

  if (assetClass === "kr_stock") {
    const digitsOnly = trimmed.replace(/[^0-9]/g, "");
    if (!/^[0-9]{1,6}$/.test(digitsOnly)) {
      throw new Error(getSymbolFormatMessage(assetClass));
    }

    return {
      assetClass,
      rawSymbol,
      normalizedSymbol: digitsOnly.padStart(6, "0"),
      currency: "KRW",
    };
  }

  if (assetClass === "us_stock") {
    const upper = trimmed.toUpperCase();
    if (!/^[A-Z0-9.-]+$/.test(upper)) {
      throw new Error(getSymbolFormatMessage(assetClass));
    }

    return {
      assetClass,
      rawSymbol,
      normalizedSymbol: upper.replace(/\./g, "-"),
      currency: "USD",
    };
  }

  const upper = trimmed.toUpperCase();
  if (!/^[A-Z0-9]+$/.test(upper)) {
    throw new Error(getSymbolFormatMessage(assetClass));
  }

  return {
    assetClass,
    rawSymbol,
    normalizedSymbol: upper,
    currency: "USD",
  };
}

export function getSymbolFormatMessage(assetClass: AssetClass) {
  if (assetClass === "kr_stock") {
    return "한국주식은 6자리 종목코드로 입력해주세요. 예: 005930";
  }

  if (assetClass === "us_stock") {
    return "미국주식은 티커 형식으로 입력해주세요. 예: AAPL";
  }

  return "디지털자산은 심볼 형식으로 입력해주세요. 예: BTC";
}
