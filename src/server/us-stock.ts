import { resolveBuyPoint, resolveCurrentPrice, type SeriesBuyPoint } from "@/server/market-utils";
import { fetchYahooSeries, type YahooSeriesPoint } from "@/server/yahoo-chart";

export type UsStockPricePoint = YahooSeriesPoint;
export type UsStockBuyPoint = SeriesBuyPoint;

export async function fetchUsStockSeries(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<UsStockPricePoint[]> {
  return fetchYahooSeries(symbol, startDate, endDate);
}

export function resolveUsStockBuyPoint(
  points: UsStockPricePoint[],
  selectedDate: string,
): UsStockBuyPoint {
  return resolveBuyPoint(points, selectedDate, "No US stock price found on or before selected date.");
}

export function resolveUsStockCurrentPrice(points: UsStockPricePoint[]): number {
  return resolveCurrentPrice(points, "No US stock price points available.");
}
