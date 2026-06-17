export type AssetClass = "kr_stock" | "us_stock" | "crypto";

export type SupportedAsset = {
  assetClass: AssetClass;
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
};

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  { assetClass: "kr_stock", symbol: "005930", name: "삼성전자", currency: "KRW" },
  { assetClass: "kr_stock", symbol: "000660", name: "SK하이닉스", currency: "KRW" },
  { assetClass: "kr_stock", symbol: "035420", name: "NAVER", currency: "KRW" },
  { assetClass: "us_stock", symbol: "AAPL", name: "Apple", currency: "USD" },
  { assetClass: "us_stock", symbol: "MSFT", name: "Microsoft", currency: "USD" },
  { assetClass: "us_stock", symbol: "NVDA", name: "NVIDIA", currency: "USD" },
  { assetClass: "crypto", symbol: "BTC", name: "Bitcoin", currency: "USD" },
  { assetClass: "crypto", symbol: "ETH", name: "Ethereum", currency: "USD" },
  { assetClass: "crypto", symbol: "SOL", name: "Solana", currency: "USD" },
];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  kr_stock: "한국주식",
  us_stock: "미국주식",
  crypto: "디지털자산",
};

export function getAssetsByClass(assetClass: AssetClass) {
  return SUPPORTED_ASSETS.filter((asset) => asset.assetClass === assetClass);
}
