"use client";

import { useEffect, useState } from "react";
import { ASSET_CLASS_LABELS, type AssetClass, type SupportedAsset } from "@/lib/supported-assets";
import { ResultChart } from "@/components/result-chart";

type SymbolSearchResult = {
  name: string;
  symbol: string;
  assetClass: AssetClass;
};

type SimulationResult = {
  asset: SupportedAsset;
  buyDate: string;
  effectiveBuyDate?: string;
  investmentAmount: number;
  normalizedInvestmentAmount?: number;
  normalizedInvestmentCurrency?: "KRW" | "USD";
  appliedFxRate?: number | null;
  appliedFxDate?: string | null;
  currentFxRate?: number | null;
  currentFxDate?: string | null;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  investedPrincipal?: number;
  cashRemainder?: number;
  currentAssetValue?: number;
  currentValue: number;
  profitLoss: number;
  returnRate: number;
  chartSeries?: Array<{
    date: string;
    close: number;
    isBuyPoint?: boolean;
  }>;
  calculationPolicy?: {
    quantityRule?: string;
  };
};

const assetGroups: { key: AssetClass; description: string }[] = [
  { key: "kr_stock", description: "예: 삼성전자, SK하이닉스, NAVER" },
  { key: "us_stock", description: "예: AAPL, MSFT, NVDA" },
  { key: "crypto", description: "예: BTC, ETH, SOL" },
];

const sampleScenarios = [
  "2024-01-02에 삼성전자에 100만 원 투자했다면?",
  "2023-01-03에 AAPL에 1,000달러 투자했다면?",
  "2024-01-02에 BTC를 샀다면 지금 수익률은?",
];

function formatCurrency(value: number, currency: "KRW" | "USD") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits = 4, minimumFractionDigits = 0) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

function formatKrwApproxFromUsd(usdValue: number, fxRate?: number | null) {
  if (!fxRate) return null;
  return formatCurrency(usdValue * fxRate, "KRW");
}

function formatWithKrwApprox(
  value: number,
  currency: "KRW" | "USD",
  fxRate?: number | null,
  signPrefix = "",
) {
  const base = `${signPrefix}${formatCurrency(value, currency)}`;
  if (currency === "USD") {
    const krwApprox = formatKrwApproxFromUsd(value, fxRate);
    if (krwApprox) {
      return `${base} (${signPrefix}${krwApprox})`;
    }
  }
  return base;
}

function generateAgentSummary(result: SimulationResult) {
  const assetLabel = `${result.asset.name} (${result.asset.symbol})`;
  const rate = result.returnRate;

  if (rate >= 100) {
    return `${assetLabel} 기준으로 매우 큰 수익 구간입니다. 기준일 진입이 장기적으로 매우 유리하게 작동했고, “그때 샀다면”이라는 질문에 강한 숫자로 답하는 사례입니다.`;
  }

  if (rate >= 30) {
    return `${assetLabel} 기준으로 의미 있는 수익 구간입니다. 기준일 매수 가정이 전체적으로 유리하게 작동했고, 회고 관점에서도 꽤 만족스러운 결과로 볼 수 있습니다.`;
  }

  if (rate >= 0) {
    return `${assetLabel} 기준으로 현재는 수익 구간이지만 상승 폭은 비교적 완만한 편입니다. 손익은 플러스지만 체감상으로는 안정적인 회고 사례에 가깝습니다.`;
  }

  if (rate > -20) {
    return `${assetLabel} 기준으로 현재는 손실 구간입니다. 다만 손실 폭이 아주 크지는 않아, 진입 시점의 차이가 결과를 바꾼 사례로 해석할 수 있습니다.`;
  }

  return `${assetLabel} 기준으로 현재는 비교적 큰 손실 구간입니다. 기준일 진입은 결과적으로 불리하게 작동했고, 같은 자산이라도 진입 시점이 성과에 큰 영향을 준다는 점이 드러납니다.`;
}

export function RetrofolioHome() {
  const [assetClass, setAssetClass] = useState<AssetClass>("kr_stock");
  const [symbol, setSymbol] = useState<string>("005930");
  const [buyDate, setBuyDate] = useState("2024-01-02");
  const [investmentAmount, setInvestmentAmount] = useState("1,000,000");
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");
  const [symbolSearchResults, setSymbolSearchResults] = useState<SymbolSearchResult[]>([]);
  const [isSymbolSearching, setIsSymbolSearching] = useState(false);
  const [symbolSelectionFeedback, setSymbolSelectionFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAsset: SupportedAsset | null =
    assetClass === "kr_stock"
      ? { assetClass, symbol: symbol || "005930", name: symbol || "KR Stock", currency: "KRW" }
      : { assetClass, symbol: symbol || (assetClass === "us_stock" ? "AAPL" : "BTC"), name: symbol || (assetClass === "us_stock" ? "US Stock" : "Digital Asset"), currency: "USD" };

  function getSymbolPlaceholder(nextClass: AssetClass) {
    if (nextClass === "kr_stock") return "예: 005930";
    if (nextClass === "us_stock") return "예: AAPL";
    return "예: BTC";
  }

  function getSymbolHelpText(nextClass: AssetClass) {
    if (nextClass === "kr_stock") return "한국주식은 6자리 종목코드로 입력합니다.";
    if (nextClass === "us_stock") return "미국주식은 티커를 입력합니다. 예: AAPL";
    return "디지털자산은 심볼을 입력합니다. 예: BTC, ETH, SOL";
  }

  function getDefaultSymbol(nextClass: AssetClass) {
    if (nextClass === "kr_stock") return "005930";
    if (nextClass === "us_stock") return "AAPL";
    return "BTC";
  }

  function getSearchPlaceholder(nextClass: AssetClass) {
    if (nextClass === "kr_stock") return "예: 삼성전자, SK하이닉스";
    if (nextClass === "us_stock") return "예: Apple, Microsoft, Berkshire";
    return "예: Bitcoin, Ethereum, Dogecoin";
  }

  function getSearchHelpText(nextClass: AssetClass) {
    if (nextClass === "kr_stock") {
      return "한국주식은 종목명으로 검색한 뒤 종목코드를 확인하는 흐름을 목표로 합니다.";
    }
    if (nextClass === "us_stock") {
      return "미국주식은 회사명으로 검색한 뒤 티커를 확인하는 흐름을 목표로 합니다.";
    }
    return "디지털자산은 자산명으로 검색한 뒤 심볼을 확인하는 흐름을 목표로 합니다.";
  }

  function handleAssetClassChange(nextClass: AssetClass) {
    setAssetClass(nextClass);
    setSymbol(getDefaultSymbol(nextClass));
    setIsSymbolSearchOpen(false);
    setSymbolSearchQuery("");
    setSymbolSearchResults([]);
    setSymbolSelectionFeedback(null);
    setResult(null);
    setError(null);
  }

  function formatAmountInput(value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("ko-KR").format(Number(digits));
  }

  function handleSymbolSearchQueryChange(value: string) {
    setSymbolSearchQuery(value);

    if (!value.trim()) {
      setSymbolSearchResults([]);
      setIsSymbolSearching(false);
    }
  }

  useEffect(() => {
    const query = symbolSearchQuery.trim();
    if (!query) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSymbolSearching(true);
      try {
        const response = await fetch(
          `/api/symbol-search?assetClass=${assetClass}&q=${encodeURIComponent(query)}`,
        );
        const data = await response.json();
        setSymbolSearchResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setSymbolSearchResults([]);
      } finally {
        setIsSymbolSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [assetClass, symbolSearchQuery]);

  async function handleSubmit() {
    if (!selectedAsset) return;

    const parsedAmount = Number(investmentAmount.replace(/,/g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("올바른 투자금액을 입력해주세요.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetClass,
          symbol,
          buyDate,
          investmentAmount: parsedAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult(null);

        if (data?.earliestAvailableDate) {
          setError(
            `입력한 기준 날짜가 너무 과거입니다. 이 자산의 조회 가능한 가장 이른 가격 데이터 일자는 ${data.earliestAvailableDate} 입니다.`,
          );
          return;
        }

        setError(data?.message ?? "시뮬레이션에 실패했습니다.");
        return;
      }

      setResult(data);
    } catch {
      setResult(null);
      setError("시뮬레이션 요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-5xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
              Launchthon / Retrofolio
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              그때 샀다면, 지금 얼마가 되었을까?
            </h1>
            <p className="mt-6 max-w-8xl text-base leading-7 text-neutral-300 sm:text-lg">
              Retrofolio는 과거 특정 날짜에 투자했다면 그 투자결과가 어떻게 되었을지 보여주는 회고형 투자 시뮬레이터입니다.
            </p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-white p-6 text-neutral-950 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                  Simulation Input
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Live Price Connected
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">자산군 선택</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {assetGroups.map((group) => {
                    const active = assetClass === group.key;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => handleAssetClassChange(group.key)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-400 hover:bg-neutral-100"
                        }`}
                      >
                        <div className="font-semibold">{ASSET_CLASS_LABELS[group.key]}</div>
                        <div className={`mt-2 text-sm leading-6 ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                          {group.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="asset" className="mb-2 block text-sm font-medium text-neutral-700">
                    종목 / 심볼 입력
                  </label>
                  <input
                    id="asset"
                    type="text"
                    value={symbol}
                    onChange={(e) => {
                      setSymbol(e.target.value);
                      setSymbolSelectionFeedback(null);
                      setResult(null);
                      setError(null);
                    }}
                    placeholder={getSymbolPlaceholder(assetClass)}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  />
                  <p className="mt-2 text-xs leading-5 text-neutral-500">{getSymbolHelpText(assetClass)}</p>
                  {symbolSelectionFeedback ? (
                    <p className="mt-2 text-xs font-medium text-emerald-600">{symbolSelectionFeedback}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="date" className="mb-2 block text-sm font-medium text-neutral-700">
                    기준 날짜
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={buyDate}
                    onChange={(e) => {
                      setBuyDate(e.target.value);
                      setResult(null);
                      setError(null);
                    }}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <div>
                  <label htmlFor="amount" className="mb-2 block text-sm font-medium text-neutral-700">
                    투자금액 (KRW)
                  </label>
                  <input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    value={investmentAmount}
                    onChange={(e) => {
                      setInvestmentAmount(formatAmountInput(e.target.value));
                      setResult(null);
                      setError(null);
                    }}
                    placeholder="예: 1,000,000원"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="inline-flex w-full items-center justify-center rounded-full bg-neutral-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                  >
                    {isLoading ? "계산 중..." : "시뮬레이션 시작"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <button
                  type="button"
                  onClick={() => setIsSymbolSearchOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">심볼 찾기</div>
                  </div>
                  <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                    {isSymbolSearchOpen ? "접기" : "펼치기"}
                  </span>
                </button>

                {isSymbolSearchOpen ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <label htmlFor="symbol-search" className="mb-2 block text-sm font-medium text-neutral-700">
                          이름으로 찾기
                        </label>
                        <input
                          id="symbol-search"
                          type="text"
                          value={symbolSearchQuery}
                          onChange={(e) => handleSymbolSearchQueryChange(e.target.value)}
                          placeholder={getSearchPlaceholder(assetClass)}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        />
                        <p className="mt-2 text-xs leading-5 text-neutral-500">{getSearchHelpText(assetClass)}</p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-950"
                      >
                        {isSymbolSearching ? "검색 중..." : "검색 가능"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm leading-6 text-neutral-500">
                      {symbolSearchQuery.trim() ? (
                        symbolSearchResults.length > 0 ? (
                          <div className="space-y-2">
                            {symbolSearchResults.map((item) => (
                              <button
                                key={`${item.assetClass}-${item.symbol}`}
                                type="button"
                                onClick={() => {
                                  setSymbol(item.symbol);
                                  setSymbolSearchQuery(item.name);
                                  setSymbolSearchResults([]);
                                  setSymbolSelectionFeedback(`${item.name} (${item.symbol}) 심볼이 입력되었습니다.`);
                                  setIsSymbolSearchOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
                              >
                                <div>
                                  <div className="font-semibold text-neutral-900">{item.name}</div>
                                  <div className="text-xs text-neutral-500">{ASSET_CLASS_LABELS[item.assetClass]}</div>
                                </div>
                                <div className="text-sm font-semibold text-neutral-900">{item.symbol}</div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div>검색 결과가 없습니다.</div>
                        )
                      ) : (
                        <div>종목명 또는 자산명을 입력하면 조회 가능한 심볼 후보가 이 영역에 표시됩니다.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">Product Positioning</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">회고형 투자 시뮬레이터</h3>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-neutral-300">
                <li>• 투자 추천이 아니라, 과거 가정에 대한 결과를 보여줍니다.</li>
                <li>• 한국주식 / 미국주식 / 디지털자산을 한 서비스 흐름으로 다룹니다.</li>
                <li>• 껄무새가 되지말고 열심히 투자합시다 라고 생각할 때 살걸..</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">Sample Scenarios</p>
              <div className="mt-4 space-y-3">
                {sampleScenarios.map((scenario) => (
                  <div
                    key={scenario}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-neutral-200"
                  >
                    {scenario}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">Simulation Result</p>
          {error ? (
            <p className="mt-3 text-sm leading-6 text-rose-100">{error}</p>
          ) : result ? (
            <div className="mt-4 space-y-4 text-sm text-emerald-50/95">
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-200/80">선택 자산</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {result.asset.name} ({result.asset.symbol})
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="당시 가격" value={formatCurrency(result.buyPrice, result.asset.currency)} />
                <MetricCard label="현재 가격 (최신 종가 기준)" value={formatCurrency(result.currentPrice, result.asset.currency)} />
                <MetricCard
                  label="매수 수량"
                  value={
                    result.asset.assetClass === "crypto"
                      ? formatNumber(result.quantity, 6, 2)
                      : formatNumber(result.quantity, 0)
                  }
                />
                <MetricCard
                  label="현재 평가금액"
                  value={formatWithKrwApprox(
                    result.currentValue,
                    result.asset.currency,
                    result.asset.assetClass === "us_stock" ? result.currentFxRate : result.appliedFxRate,
                  )}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-emerald-50/90">
                    <div>
                      선택 기준일: <span className="font-semibold text-white">{result.buyDate}</span>
                    </div>
                    <div>
                      실제 적용 매수일: <span className="font-semibold text-white">{result.effectiveBuyDate ?? result.buyDate}</span>
                    </div>
                    {result.asset.assetClass !== "kr_stock" && result.appliedFxRate ? (
                      <div>
                        적용 환율{result.appliedFxDate ? ` (${result.appliedFxDate})` : ""}: <span className="font-semibold text-white">1 USD = {formatNumber(result.appliedFxRate, 2, 2)} KRW</span>
                      </div>
                    ) : null}
                    {result.asset.assetClass !== "kr_stock" ? (
                      <div className="text-xs leading-5 text-emerald-100/80">
                        미국주식/디지털자산의 KRW 환산 표시는 기준일 환율 기준 참고값입니다.
                      </div>
                    ) : null}
                    {result.asset.assetClass !== "kr_stock" && result.normalizedInvestmentAmount ? (
                      <div>
                        환산 투자금액: <span className="font-semibold text-white">{formatCurrency(result.normalizedInvestmentAmount, "USD")}</span>
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs leading-5 text-emerald-100/80">
                      비거래일 또는 휴장일을 선택한 경우 직전 거래 가능 일자의 가격을 적용합니다.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-wider text-emerald-200/80">결과 요약</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {result.effectiveBuyDate ?? result.buyDate} 기준으로 {result.asset.name}에 {formatCurrency(result.investmentAmount, "KRW")} 투자했다면
                    </div>
                    <div className={`mt-3 text-2xl font-bold ${result.profitLoss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatWithKrwApprox(
                        Math.abs(result.profitLoss),
                        result.asset.currency,
                        result.asset.assetClass === "us_stock" ? result.currentFxRate : result.appliedFxRate,
                        result.profitLoss >= 0 ? "+" : "-",
                      )}
                    </div>
                    <div className={`mt-1 text-sm font-medium ${result.profitLoss >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      수익률 {result.returnRate >= 0 ? "+" : ""}
                      {formatNumber(result.returnRate, 2, 2)}%
                    </div>
                  </div>
                </div>

                {result.chartSeries && result.chartSeries.length > 0 ? (
                  <ResultChart data={result.chartSeries} currency={result.asset.currency} />
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wider text-emerald-200/80">AI agent 총평</div>
                <p className="mt-3 text-sm leading-7 text-white/95">{generateAgentSummary(result)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-emerald-50/90">
              상단 폼에서 자산과 날짜, 투자금액을 선택한 뒤 시뮬레이션 시작 버튼을 누르면 실제 가격 데이터를 기준으로 계산된 결과가 이 영역에 표시됩니다.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wider text-emerald-200/80">{label}</div>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
    </div>
  );
}
