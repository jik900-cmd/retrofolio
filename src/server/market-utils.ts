export type SeriesBuyPoint = {
  selectedDate: string;
  effectiveBuyDate: string;
  buyPrice: number;
};

export function resolveBuyPoint<T extends { date: string; close: number }>(
  points: T[],
  selectedDate: string,
  errorMessage: string,
): SeriesBuyPoint {
  const eligiblePoints = points.filter((point) => point.date <= selectedDate);

  if (eligiblePoints.length === 0) {
    const earliestAvailableDate = points[0]?.date;
    const error = new Error(errorMessage) as Error & { earliestAvailableDate?: string };
    error.earliestAvailableDate = earliestAvailableDate;
    throw error;
  }

  const point = eligiblePoints[eligiblePoints.length - 1];
  return {
    selectedDate,
    effectiveBuyDate: point.date,
    buyPrice: point.close,
  };
}

export function resolveCurrentPrice<T extends { close: number }>(
  points: T[],
  errorMessage: string,
): number {
  if (points.length === 0) {
    throw new Error(errorMessage);
  }

  return points[points.length - 1].close;
}
