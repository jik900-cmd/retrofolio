import { resolveBuyPoint, resolveCurrentPrice, type SeriesBuyPoint } from "@/server/market-utils";
import { fetchYahooSeries, type YahooSeriesPoint } from "@/server/yahoo-chart";

export type KrStockPricePoint = YahooSeriesPoint;
export type KrStockBuyPoint = SeriesBuyPoint;

function toProviderSymbol(symbol: string) {
  return `${symbol}.KS`;
}

export async function fetchKrStockSeries(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<KrStockPricePoint[]> {
  return fetchYahooSeries(toProviderSymbol(symbol), startDate, endDate);
}

export function resolveKrStockBuyPoint(
  points: KrStockPricePoint[],
  selectedDate: string,
): KrStockBuyPoint {
  return resolveBuyPoint(points, selectedDate, "No KR stock price found on or before selected date.");
}

export function resolveKrStockCurrentPrice(points: KrStockPricePoint[]): number {
  return resolveCurrentPrice(points, "No KR stock price points available.");
}
