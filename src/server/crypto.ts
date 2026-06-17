import { resolveBuyPoint, resolveCurrentPrice, type SeriesBuyPoint } from "@/server/market-utils";
import { fetchYahooSeries, type YahooSeriesPoint } from "@/server/yahoo-chart";

export type CryptoPricePoint = YahooSeriesPoint;
export type CryptoBuyPoint = SeriesBuyPoint;

function toProviderSymbol(symbol: string) {
  return `${symbol}-USD`;
}

export async function fetchCryptoSeries(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<CryptoPricePoint[]> {
  return fetchYahooSeries(toProviderSymbol(symbol), startDate, endDate);
}

export function resolveCryptoBuyPoint(
  points: CryptoPricePoint[],
  selectedDate: string,
): CryptoBuyPoint {
  return resolveBuyPoint(points, selectedDate, "No crypto price found on or before selected date.");
}

export function resolveCryptoCurrentPrice(points: CryptoPricePoint[]): number {
  return resolveCurrentPrice(points, "No crypto price points available.");
}
