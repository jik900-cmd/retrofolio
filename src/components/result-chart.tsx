"use client";

import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  date: string;
  close: number;
  isBuyPoint?: boolean;
};

type ResultChartProps = {
  data: ChartPoint[];
  currency: "KRW" | "USD";
};

function formatAxisValue(value: number, currency: "KRW" | "USD") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(value);
}

export function ResultChart({ data, currency }: ResultChartProps) {
  const buyPoint = data.find((point) => point.isBuyPoint);
  const highPoint = data.reduce((max, point) => (point.close > max.close ? point : max), data[0]);
  const lowPoint = data.reduce((min, point) => (point.close < min.close ? point : min), data[0]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs uppercase tracking-wider text-emerald-200/80">
        Price History
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 16, bottom: 24, left: 8 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#d4d4d8", fontSize: 12 }}
              tickFormatter={(value: string) => value.slice(2)}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#d4d4d8", fontSize: 12 }}
              tickFormatter={(value: number) =>
                currency === "KRW"
                  ? `${Math.round(value / 1000)}k`
                  : `${Math.round(value)}`
              }
              width={56}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? formatAxisValue(value, currency) : String(value ?? "")
              }
              labelFormatter={(label) => `날짜: ${String(label)}`}
              contentStyle={{
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#ffffff",
              }}
            />
            {buyPoint ? (
              <ReferenceDot
                x={buyPoint.date}
                y={buyPoint.close}
                r={5}
                fill="#f59e0b"
                stroke="#fbbf24"
                label={{ value: "매수", position: "top", fill: "#fcd34d", fontSize: 12 }}
              />
            ) : null}
            {highPoint ? (
              <ReferenceDot
                x={highPoint.date}
                y={highPoint.close}
                r={5}
                fill="#60a5fa"
                stroke="#93c5fd"
                label={{ value: "최고", position: "top", fill: "#bfdbfe", fontSize: 12 }}
              />
            ) : null}
            {lowPoint ? (
              <ReferenceDot
                x={lowPoint.date}
                y={lowPoint.close}
                r={5}
                fill="#f472b6"
                stroke="#f9a8d4"
                label={{ value: "최저", position: "bottom", fill: "#fbcfe8", fontSize: 12 }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
