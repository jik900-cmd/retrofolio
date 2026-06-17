import { NextResponse } from "next/server";

import type { AssetClass } from "@/lib/supported-assets";
import {
  fetchKrStockSeries,
  resolveKrStockBuyPoint,
  resolveKrStockCurrentPrice,
  type KrStockPricePoint,
} from "@/server/kr-stock";
import { fetchUsdKrwSeries, resolveUsdKrwRate } from "@/server/fx-rate";
import { normalizeSymbol } from "@/server/symbol-normalizer";
import {
  fetchUsStockSeries,
  resolveUsStockBuyPoint,
  resolveUsStockCurrentPrice,
  type UsStockPricePoint,
} from "@/server/us-stock";
import {
  fetchCryptoSeries,
  resolveCryptoBuyPoint,
  resolveCryptoCurrentPrice,
  type CryptoPricePoint,
} from "@/server/crypto";
import { YahooChartError } from "@/server/yahoo-chart";

export const runtime = "nodejs";
export const maxDuration = 15;

type SimulationRequest = {
  assetClass: AssetClass;
  symbol: string;
  buyDate: string;
  investmentAmount: number;
};

type EarliestAvailableDateError = Error & {
  earliestAvailableDate?: string;
  statusCode?: number;
};

type ChartPoint = {
  date: string;
  close: number;
  isBuyPoint?: boolean;
};

function truncateToInteger(value: number) {
  return Math.floor(value);
}

function toChartSeries(
  points: KrStockPricePoint[] | UsStockPricePoint[] | CryptoPricePoint[],
  effectiveBuyDate: string,
): ChartPoint[] {
  return points.map((point) => ({
    date: point.date,
    close: point.close,
    isBuyPoint: point.date === effectiveBuyDate,
  }));
}

async function ensurePointsWithEarliestDate(
  assetClass: AssetClass,
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<KrStockPricePoint[] | UsStockPricePoint[] | CryptoPricePoint[]> {
  let primaryPoints: KrStockPricePoint[] | UsStockPricePoint[] | CryptoPricePoint[] = [];

  try {
    primaryPoints =
      assetClass === "kr_stock"
        ? await fetchKrStockSeries(symbol, startDate, endDate)
        : assetClass === "us_stock"
          ? await fetchUsStockSeries(symbol, startDate, endDate)
          : await fetchCryptoSeries(symbol, startDate, endDate);
  } catch (error) {
    if (error instanceof YahooChartError) {
      throw error;
    }
    primaryPoints = [];
  }

  if (primaryPoints.length > 0) {
    return primaryPoints;
  }

  const fallbackStartDate =
    assetClass === "kr_stock"
      ? "1980-01-01"
      : assetClass === "us_stock"
        ? "1985-01-01"
        : "2010-01-01";

  const fallbackPoints =
    assetClass === "kr_stock"
      ? await fetchKrStockSeries(symbol, fallbackStartDate, endDate)
      : assetClass === "us_stock"
        ? await fetchUsStockSeries(symbol, fallbackStartDate, endDate)
        : await fetchCryptoSeries(symbol, fallbackStartDate, endDate);

  const error: EarliestAvailableDateError = new Error("Selected date is earlier than available price history.");
  error.earliestAvailableDate = fallbackPoints[0]?.date;
  throw error;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SimulationRequest;
    const { assetClass, symbol, buyDate, investmentAmount } = body;

    if (!assetClass || !symbol || !buyDate || !Number.isFinite(investmentAmount) || investmentAmount <= 0) {
      return NextResponse.json({ message: "Invalid input.", code: "INVALID_INPUT" }, { status: 400 });
    }

    let normalized;

    try {
      normalized = normalizeSymbol(assetClass, symbol);
    } catch (error) {
      return NextResponse.json(
        {
          message: error instanceof Error ? error.message : "Invalid symbol format.",
          code: "INVALID_SYMBOL",
        },
        { status: 400 },
      );
    }

    const asset = {
      assetClass,
      symbol: normalized.normalizedSymbol,
      name: normalized.normalizedSymbol,
      currency: normalized.currency,
    };

    let buyPrice: number;
    let currentPrice: number;
    let effectiveBuyDate = buyDate;
    let chartSeries: ChartPoint[] = [];
    let normalizedInvestmentAmount = investmentAmount;
    let normalizedInvestmentCurrency: "KRW" | "USD" = assetClass === "kr_stock" ? "KRW" : "USD";
    let appliedFxRate: number | null = null;
    let appliedFxDate: string | null = null;
    let currentFxRate: number | null = null;
    let currentFxDate: string | null = null;

    if (assetClass === "kr_stock") {
      const today = new Date().toISOString().slice(0, 10);
      const startDate = new Date(`${buyDate}T00:00:00`);
      startDate.setDate(startDate.getDate() - 10);
      const paddedStartDate = startDate.toISOString().slice(0, 10);
      const points = (await ensurePointsWithEarliestDate(
        assetClass,
        normalized.normalizedSymbol,
        paddedStartDate,
        today,
      )) as KrStockPricePoint[];
      const buyPoint = resolveKrStockBuyPoint(points, buyDate);
      buyPrice = buyPoint.buyPrice;
      effectiveBuyDate = buyPoint.effectiveBuyDate;
      currentPrice = resolveKrStockCurrentPrice(points);
      chartSeries = toChartSeries(points, effectiveBuyDate);
    } else if (assetClass === "us_stock") {
      const today = new Date().toISOString().slice(0, 10);
      const startDate = new Date(`${buyDate}T00:00:00`);
      startDate.setDate(startDate.getDate() - 10);
      const paddedStartDate = startDate.toISOString().slice(0, 10);
      const points = (await ensurePointsWithEarliestDate(
        assetClass,
        normalized.normalizedSymbol,
        paddedStartDate,
        today,
      )) as UsStockPricePoint[];
      const buyPoint = resolveUsStockBuyPoint(points, buyDate);
      buyPrice = buyPoint.buyPrice;
      effectiveBuyDate = buyPoint.effectiveBuyDate;
      currentPrice = resolveUsStockCurrentPrice(points);
      chartSeries = toChartSeries(points, effectiveBuyDate);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const startDate = new Date(`${buyDate}T00:00:00`);
      startDate.setDate(startDate.getDate() - 10);
      const paddedStartDate = startDate.toISOString().slice(0, 10);
      const points = (await ensurePointsWithEarliestDate(
        assetClass,
        normalized.normalizedSymbol,
        paddedStartDate,
        today,
      )) as CryptoPricePoint[];
      const buyPoint = resolveCryptoBuyPoint(points, buyDate);
      buyPrice = buyPoint.buyPrice;
      effectiveBuyDate = buyPoint.effectiveBuyDate;
      currentPrice = resolveCryptoCurrentPrice(points);
      chartSeries = toChartSeries(points, effectiveBuyDate);
    }

    if (assetClass === "us_stock" || assetClass === "crypto") {
      const fxStartDate = new Date(`${effectiveBuyDate}T00:00:00`);
      fxStartDate.setDate(fxStartDate.getDate() - 10);
      const paddedFxStartDate = fxStartDate.toISOString().slice(0, 10);
      const fxPoints = await fetchUsdKrwSeries(paddedFxStartDate, effectiveBuyDate);
      const fxPoint = resolveUsdKrwRate(fxPoints, effectiveBuyDate);
      appliedFxRate = fxPoint.close;
      appliedFxDate = fxPoint.date;
      normalizedInvestmentAmount = investmentAmount / appliedFxRate;
      normalizedInvestmentCurrency = "USD";

      if (assetClass === "us_stock") {
        const today = new Date().toISOString().slice(0, 10);
        const currentFxStartDate = new Date(`${today}T00:00:00`);
        currentFxStartDate.setDate(currentFxStartDate.getDate() - 10);
        const paddedCurrentFxStartDate = currentFxStartDate.toISOString().slice(0, 10);
        const currentFxPoints = await fetchUsdKrwSeries(paddedCurrentFxStartDate, today);
        const currentFxPoint = resolveUsdKrwRate(currentFxPoints, today);
        currentFxRate = currentFxPoint.close;
        currentFxDate = currentFxPoint.date;
      }
    }

    const rawQuantity = normalizedInvestmentAmount / buyPrice;
    const quantity = assetClass === "crypto" ? rawQuantity : truncateToInteger(rawQuantity);
    const investedPrincipal = quantity * buyPrice;
    const cashRemainder = assetClass === "kr_stock" || assetClass === "us_stock"
      ? normalizedInvestmentAmount - investedPrincipal
      : 0;
    const currentAssetValue = quantity * currentPrice;
    const currentValue = currentAssetValue + cashRemainder;
    const profitLoss = currentValue - normalizedInvestmentAmount;
    const returnRate = (profitLoss / normalizedInvestmentAmount) * 100;

    return NextResponse.json({
      asset,
      buyDate,
      effectiveBuyDate,
      investmentAmount,
      normalizedInvestmentAmount,
      normalizedInvestmentCurrency,
      appliedFxRate,
      appliedFxDate,
      currentFxRate,
      currentFxDate,
      buyPrice,
      currentPrice,
      quantity,
      investedPrincipal,
      cashRemainder,
      currentAssetValue,
      currentValue,
      profitLoss,
      returnRate,
      chartSeries,
      calculationPolicy: {
        quantityRule:
          assetClass === "crypto"
            ? "crypto keeps fractional quantity"
            : "stock quantity is truncated at the integer place",
        cashHandling:
          assetClass === "kr_stock"
            ? "unused KRW cash remainder from the buy date is added to current portfolio value"
            : assetClass === "us_stock"
              ? "unused USD cash remainder after the FX conversion and buy is added to current portfolio value"
              : "no extra cash remainder adjustment applied yet",
        priceSource: "Yahoo historical series",
        cachePolicy: "Next fetch revalidate 300s",
        retryPolicy: "Up to 3 attempts on timeout / 429 / 5xx with backoff",
      },
    });
  } catch (error) {
    const earliestAvailableDate =
      error && typeof error === "object" && "earliestAvailableDate" in error
        ? String((error as { earliestAvailableDate?: string }).earliestAvailableDate ?? "")
        : undefined;

    if (earliestAvailableDate) {
      return NextResponse.json(
        {
          message: "Selected date is earlier than available price history.",
          code: "EARLIER_THAN_AVAILABLE_HISTORY",
          earliestAvailableDate,
        },
        { status: 400 },
      );
    }

    if (error instanceof YahooChartError) {
      const status = error.statusCode === 429 ? 503 : 502;
      return NextResponse.json(
        {
          message:
            error.statusCode === 429
              ? "시장 데이터 제공자 요청이 잠시 많습니다. 잠시 후 다시 시도해주세요."
              : "시장 데이터 제공자에서 가격 데이터를 안정적으로 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
          code: error.code ?? "YAHOO_FETCH_FAILED",
          provider: "yahoo",
          retryable: error.retryable,
          retryAfterSeconds: error.retryAfterSeconds ?? null,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        message: "입력한 심볼의 가격 데이터를 찾을 수 없습니다. 심볼 형식이나 지원 여부를 다시 확인해주세요.",
        code: "SIMULATION_FAILED",
      },
      { status: 400 },
    );
  }
}
