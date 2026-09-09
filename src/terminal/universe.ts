/**
 * Terminal instrument identity.
 *
 * Symbols and display names only — no prices. Instrument tokens are resolved at
 * runtime from `/api/v1/quotes/{symbol}`, because the pipeline exposes no
 * `/instruments` route and a hardcoded token would be an invented contract.
 */

import type { TerminalInstrument } from "@/terminal/types";

function index(symbol: string, shortName: string): TerminalInstrument {
  return { symbol, shortName, exchange: "NSE", kind: "INDEX" };
}

function eq(symbol: string): TerminalInstrument {
  return { symbol, shortName: symbol, exchange: "NSE", kind: "EQ" };
}

export const TERMINAL_UNIVERSE: TerminalInstrument[] = [
  index("NIFTY 50", "NIFTY 50"),
  index("NIFTY BANK", "BANKNIFTY"),
  eq("RELIANCE"),
  eq("HDFCBANK"),
  eq("INFY"),
  eq("ICICIBANK"),
  eq("TCS"),
  eq("SBIN"),
  eq("LT"),
  eq("BHARTIARTL"),
  eq("ITC"),
  eq("AXISBANK"),
  eq("KOTAKBANK"),
  eq("MARUTI"),
  eq("SUNPHARMA"),
  eq("WIPRO"),
  eq("HINDUNILVR"),
  eq("BAJFINANCE"),
  eq("ADANIENT"),
];

export const UNIVERSE_SYMBOLS: string[] = TERMINAL_UNIVERSE.map((i) => i.symbol);

export const DEFAULT_INSTRUMENT: TerminalInstrument = TERMINAL_UNIVERSE[0];

/**
 * Index strip. Only the two indices the pipeline actually ingests — SENSEX is a
 * BSE index and India VIX is not in the subscribed universe, so neither is shown.
 */
export const INDEX_STRIP: TerminalInstrument[] = [TERMINAL_UNIVERSE[0], TERMINAL_UNIVERSE[1]];

/** Chart intervals the backend accepts (`market.ohlc.CHART_INTERVALS`). */
export const TERMINAL_TIMEFRAMES = ["1m", "5m", "15m", "60m", "1D"] as const;

export function timeframeLabel(tf: string): string {
  return tf === "60m" ? "1H" : tf;
}
