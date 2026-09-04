/** Instrument identity mapping — matches backend INDEX_SPOT_BY_NAME. Not market data. */

export interface IndexInstrument {
  underlying: string;
  spotSymbol: string;
  label: string;
}

export const INDEX_INSTRUMENTS: IndexInstrument[] = [
  { underlying: "NIFTY", spotSymbol: "NIFTY 50", label: "NIFTY" },
  { underlying: "BANKNIFTY", spotSymbol: "NIFTY BANK", label: "BANKNIFTY" },
];

export const SPOT_TO_UNDERLYING: Record<string, string> = {
  "NIFTY 50": "NIFTY",
  "NIFTY BANK": "BANKNIFTY",
};

export const UNDERLYING_TO_SPOT: Record<string, string> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
};

export function underlyingForSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (SPOT_TO_UNDERLYING[upper]) return SPOT_TO_UNDERLYING[upper];
  if (UNDERLYING_TO_SPOT[upper]) return upper;
  if (upper === "NIFTY") return "NIFTY";
  if (upper === "BANKNIFTY") return "BANKNIFTY";
  return upper;
}

export function spotSymbolFor(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (UNDERLYING_TO_SPOT[upper]) return UNDERLYING_TO_SPOT[upper];
  return upper;
}

export function displayName(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "NIFTY 50" || upper === "NIFTY") return "NIFTY";
  if (upper === "NIFTY BANK" || upper === "BANKNIFTY") return "BANKNIFTY";
  return upper;
}

export function symbolHref(symbol: string, tab?: string): string {
  const enc = encodeURIComponent(symbol);
  return tab ? `/symbol/${enc}/${tab}` : `/symbol/${enc}`;
}

export function decodeParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const SYMBOL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "chart", label: "Chart" },
  { id: "options", label: "Options" },
  { id: "futures", label: "Futures" },
  { id: "activity", label: "Activity" },
  { id: "oi", label: "OI" },
  { id: "unusual", label: "Unusual" },
] as const;

export type SymbolTab = (typeof SYMBOL_TABS)[number]["id"];

export const CHART_TIMEFRAMES = ["1m", "3m", "5m", "10m", "15m", "30m", "60m", "1D"] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export function timeframeMs(tf: ChartTimeframe): number | null {
  const map: Record<ChartTimeframe, number | null> = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "10m": 600_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "60m": 3_600_000,
    "1D": 86_400_000,
  };
  return map[tf];
}

export const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/markets", label: "Markets" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/options/NIFTY", label: "Options" },
  { href: "/futures/NIFTY", label: "Futures" },
  { href: "/activity", label: "Activity" },
  { href: "/charts", label: "Charts" },
  { href: "/unusual", label: "Unusual" },
  { href: "/cross-market/NIFTY", label: "Cross-market" },
] as const;
