import { fetchYahooSeries } from "@/server/yahoo-chart";

export type FxRatePoint = {
  date: string;
  close: number;
};

export async function fetchUsdKrwSeries(
  startDate: string,
  endDate: string,
): Promise<FxRatePoint[]> {
  const points = await fetchYahooSeries("KRW=X", startDate, endDate);
  return points.map((point) => ({ date: point.date, close: point.close }));
}

export function resolveUsdKrwRate(points: FxRatePoint[], selectedDate: string): FxRatePoint {
  const eligiblePoints = points.filter((point) => point.date <= selectedDate);

  if (eligiblePoints.length === 0) {
    throw new Error("No USD/KRW rate found on or before selected date.");
  }

  return eligiblePoints[eligiblePoints.length - 1];
}
