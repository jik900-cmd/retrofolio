export type YahooSeriesPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export class YahooChartError extends Error {
  statusCode?: number;
  code?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  providerSymbol: string;

  constructor({
    message,
    providerSymbol,
    statusCode,
    code,
    retryable,
    retryAfterSeconds,
  }: {
    message: string;
    providerSymbol: string;
    statusCode?: number;
    code?: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  }) {
    super(message);
    this.name = "YahooChartError";
    this.providerSymbol = providerSymbol;
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const YAHOO_REVALIDATE_SECONDS = 300;
const YAHOO_TIMEOUT_MS = 8000;
const YAHOO_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function toUnixSeconds(date: string, addDays = 0) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + addDays);
  return Math.floor(value.getTime() / 1000);
}

function toIsoDate(timestampSeconds: number) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

function backoffDelayMs(attempt: number, retryAfterSeconds?: number) {
  if (retryAfterSeconds != null) {
    return Math.min(retryAfterSeconds * 1000, 10_000);
  }

  return Math.min(400 * 2 ** (attempt - 1), 2_000);
}

function toErrorMessage(error: unknown, providerSymbol: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return `Yahoo chart fetch failed for ${providerSymbol}`;
}

async function fetchYahooChartJson(providerSymbol: string, startDate: string, endDate: string) {
  const period1 = toUnixSeconds(startDate, 0);
  const period2 = toUnixSeconds(endDate, 1);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

  let lastError: YahooChartError | undefined;

  for (let attempt = 1; attempt <= YAHOO_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 Retrofolio/1.0",
          Accept: "application/json",
        },
        next: { revalidate: YAHOO_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS),
      });

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
        const retryable = RETRYABLE_STATUS_CODES.has(response.status);
        const error = new YahooChartError({
          message: `Yahoo chart fetch failed for ${providerSymbol} with status ${response.status}`,
          providerSymbol,
          statusCode: response.status,
          code: `HTTP_${response.status}`,
          retryable,
          retryAfterSeconds,
        });

        if (retryable && attempt < YAHOO_MAX_ATTEMPTS) {
          await sleep(backoffDelayMs(attempt, retryAfterSeconds));
          continue;
        }

        throw error;
      }

      return (await response.json()) as {
        chart?: {
          error?: { code?: string; description?: string } | null;
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: Array<number | null>;
                high?: Array<number | null>;
                low?: Array<number | null>;
                close?: Array<number | null>;
                volume?: Array<number | null>;
              }>;
            };
          }>;
        };
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "TimeoutError";
      const yahooError =
        error instanceof YahooChartError
          ? error
          : new YahooChartError({
              message: isAbort
                ? `Yahoo chart fetch timed out for ${providerSymbol}`
                : toErrorMessage(error, providerSymbol),
              providerSymbol,
              code: isAbort ? "TIMEOUT" : "FETCH_FAILED",
              retryable: true,
            });

      lastError = yahooError;

      if (!yahooError.retryable || attempt >= YAHOO_MAX_ATTEMPTS) {
        throw yahooError;
      }

      await sleep(backoffDelayMs(attempt, yahooError.retryAfterSeconds));
    }
  }

  throw (
    lastError ??
    new YahooChartError({
      message: `Yahoo chart fetch failed for ${providerSymbol}`,
      providerSymbol,
      code: "UNKNOWN",
      retryable: false,
    })
  );
}

export async function fetchYahooSeries(
  providerSymbol: string,
  startDate: string,
  endDate: string,
): Promise<YahooSeriesPoint[]> {
  const json = await fetchYahooChartJson(providerSymbol, startDate, endDate);

  const error = json.chart?.error;
  if (error) {
    throw new YahooChartError({
      message: error.description || error.code || `Yahoo chart error for ${providerSymbol}`,
      providerSymbol,
      code: error.code || "YAHOO_CHART_ERROR",
      retryable: false,
    });
  }

  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    return [];
  }

  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const points: YahooSeriesPoint[] = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (close == null) continue;

    points.push({
      date: toIsoDate(timestamps[i]),
      open: opens[i] ?? close,
      high: highs[i] ?? close,
      low: lows[i] ?? close,
      close,
      volume: volumes[i] ?? null,
    });
  }

  return points;
}
