import type { Candle } from "@/lib/candles";
import {
  PHASE6A_SOURCE,
  type ActivitySnapshot,
  type CoreSnapshot,
  type FixtureCandle,
  type FuturesSnapshot,
  type IndexStripItem,
  type IntelligenceSnapshot,
  type MarketwatchRow,
  type OptionsSnapshot,
  type TerminalInstrument,
} from "@/terminal/types";

/** Isolated Phase 6A presentation data. Not production quotes, ticks, or signals. */

const NIFTY: TerminalInstrument = {
  symbol: "NIFTY 50",
  shortName: "NIFTY 50",
  exchange: "NSE",
  kind: "INDEX",
};

const BANKNIFTY: TerminalInstrument = {
  symbol: "NIFTY BANK",
  shortName: "BANKNIFTY",
  exchange: "NSE",
  kind: "INDEX",
};

function eq(symbol: string): TerminalInstrument {
  return { symbol, shortName: symbol, exchange: "NSE", kind: "EQ" };
}

export const PHASE6A_INSTRUMENTS: TerminalInstrument[] = [
  NIFTY,
  BANKNIFTY,
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

export const PHASE6A_INDEX_STRIP: IndexStripItem[] = [
  { source: PHASE6A_SOURCE, label: "NIFTY", changePct: 0.75, last: 24612.35 },
  { source: PHASE6A_SOURCE, label: "SENSEX", changePct: -0.12, last: 80412.1 },
  { source: PHASE6A_SOURCE, label: "VIX", changePct: null, last: 12.84 },
];

export const PHASE6A_MARKETWATCH: MarketwatchRow[] = [
  { source: PHASE6A_SOURCE, instrument: NIFTY, ltp: 24612.35, changePct: 0.75, volume: null, oi: null, bid: 24612.0, ask: 24612.7 },
  { source: PHASE6A_SOURCE, instrument: BANKNIFTY, ltp: 52140.2, changePct: 0.42, volume: null, oi: null, bid: 52138.0, ask: 52142.0 },
  { source: PHASE6A_SOURCE, instrument: eq("RELIANCE"), ltp: 1482.4, changePct: 1.12, volume: 4_820_000, oi: null, bid: 1482.1, ask: 1482.6 },
  { source: PHASE6A_SOURCE, instrument: eq("HDFCBANK"), ltp: 1648.9, changePct: -0.38, volume: 6_210_000, oi: null, bid: 1648.6, ask: 1649.1 },
  { source: PHASE6A_SOURCE, instrument: eq("INFY"), ltp: 1588.0, changePct: 1.38, volume: 3_140_000, oi: null, bid: 1587.7, ask: 1588.2 },
  { source: PHASE6A_SOURCE, instrument: eq("ICICIBANK"), ltp: 1211.5, changePct: 0.21, volume: 5_040_000, oi: null, bid: 1211.2, ask: 1211.7 },
  { source: PHASE6A_SOURCE, instrument: eq("TCS"), ltp: 3924.0, changePct: -0.18, volume: 1_120_000, oi: null, bid: 3923.5, ask: 3924.4 },
  { source: PHASE6A_SOURCE, instrument: eq("SBIN"), ltp: 812.35, changePct: 0.64, volume: 8_330_000, oi: null, bid: 812.2, ask: 812.5 },
  { source: PHASE6A_SOURCE, instrument: eq("LT"), ltp: 3610.0, changePct: 0.08, volume: 890_000, oi: null, bid: 3609.5, ask: 3610.4 },
  { source: PHASE6A_SOURCE, instrument: eq("BHARTIARTL"), ltp: 1654.25, changePct: -0.22, volume: 2_010_000, oi: null, bid: 1654.0, ask: 1654.5 },
  { source: PHASE6A_SOURCE, instrument: eq("ITC"), ltp: 412.8, changePct: 0.31, volume: 7_440_000, oi: null, bid: 412.7, ask: 412.9 },
  { source: PHASE6A_SOURCE, instrument: eq("AXISBANK"), ltp: 1104.6, changePct: -0.14, volume: 4_180_000, oi: null, bid: 1104.4, ask: 1104.8 },
  { source: PHASE6A_SOURCE, instrument: eq("KOTAKBANK"), ltp: 1788.15, changePct: 0.00, volume: 1_560_000, oi: null, bid: 1788.0, ask: 1788.3 },
  { source: PHASE6A_SOURCE, instrument: eq("MARUTI"), ltp: 12740.0, changePct: 0.54, volume: 420_000, oi: null, bid: 12738.0, ask: 12742.0 },
  { source: PHASE6A_SOURCE, instrument: eq("SUNPHARMA"), ltp: 1692.4, changePct: -0.09, volume: 1_880_000, oi: null, bid: 1692.1, ask: 1692.7 },
  { source: PHASE6A_SOURCE, instrument: eq("WIPRO"), ltp: 498.35, changePct: 0.46, volume: 5_620_000, oi: null, bid: 498.2, ask: 498.5 },
  { source: PHASE6A_SOURCE, instrument: eq("HINDUNILVR"), ltp: 2486.0, changePct: -0.27, volume: 980_000, oi: null, bid: 2485.5, ask: 2486.4 },
  { source: PHASE6A_SOURCE, instrument: eq("BAJFINANCE"), ltp: 7210.5, changePct: 0.88, volume: 1_240_000, oi: null, bid: 7209.0, ask: 7211.5 },
  { source: PHASE6A_SOURCE, instrument: eq("ADANIENT"), ltp: 2284.7, changePct: -1.12, volume: 3_560_000, oi: null, bid: 2284.2, ask: 2285.1 },
];

const CORE_BY_SYMBOL: Record<string, Omit<CoreSnapshot, "instrument" | "source">> = {
  "NIFTY 50": { ltp: 24612.35, changeAbs: 184.2, changePct: 0.75, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 50, updatedLabel: "12:42:51" },
  "NIFTY BANK": { ltp: 52140.2, changeAbs: 218.4, changePct: 0.42, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 15, updatedLabel: "12:42:51" },
  RELIANCE: { ltp: 1482.4, changeAbs: 16.4, changePct: 1.12, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  HDFCBANK: { ltp: 1648.9, changeAbs: -6.3, changePct: -0.38, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  INFY: { ltp: 1588.0, changeAbs: 21.6, changePct: 1.38, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  ICICIBANK: { ltp: 1211.5, changeAbs: 2.55, changePct: 0.21, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  TCS: { ltp: 3924.0, changeAbs: -7.1, changePct: -0.18, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  SBIN: { ltp: 812.35, changeAbs: 5.15, changePct: 0.64, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  LT: { ltp: 3610.0, changeAbs: 2.9, changePct: 0.08, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  BHARTIARTL: { ltp: 1654.25, changeAbs: -3.65, changePct: -0.22, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  ITC: { ltp: 412.8, changeAbs: 1.28, changePct: 0.31, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  AXISBANK: { ltp: 1104.6, changeAbs: -1.55, changePct: -0.14, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  KOTAKBANK: { ltp: 1788.15, changeAbs: 0, changePct: 0, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  MARUTI: { ltp: 12740.0, changeAbs: 68.4, changePct: 0.54, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  SUNPHARMA: { ltp: 1692.4, changeAbs: -1.55, changePct: -0.09, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  WIPRO: { ltp: 498.35, changeAbs: 2.28, changePct: 0.46, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  HINDUNILVR: { ltp: 2486.0, changeAbs: -6.75, changePct: -0.27, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  BAJFINANCE: { ltp: 7210.5, changeAbs: 62.9, changePct: 0.88, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
  ADANIENT: { ltp: 2284.7, changeAbs: -25.9, changePct: -1.12, marketStateLabel: "Market open", tickSize: 0.05, lotSize: 1, updatedLabel: "12:42:51" },
};

export function phase6aCoreSnapshot(instrument: TerminalInstrument): CoreSnapshot {
  const row = CORE_BY_SYMBOL[instrument.symbol] ?? CORE_BY_SYMBOL["NIFTY 50"];
  return { source: PHASE6A_SOURCE, instrument, ...row };
}

function seededCandles(base: number, count: number): FixtureCandle[] {
  const out: FixtureCandle[] = [];
  let px = base * 0.992;
  const start = 1_778_000_000;
  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 7) * (base * 0.0011) + (i % 5 === 0 ? -base * 0.0004 : base * 0.00025);
    const open = px;
    const close = px + drift;
    const high = Math.max(open, close) + base * 0.0006;
    const low = Math.min(open, close) - base * 0.0005;
    out.push({
      source: PHASE6A_SOURCE,
      time: start + i * 300,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: 1_200_000 + ((i * 37_000) % 900_000),
    });
    px = close;
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const PHASE6A_CANDLES: Record<string, FixtureCandle[]> = {
  "NIFTY 50": seededCandles(24612.35, 80),
  "NIFTY BANK": seededCandles(52140.2, 80),
};

export function phase6aCandles(symbol: string): FixtureCandle[] {
  return PHASE6A_CANDLES[symbol] ?? seededCandles(phase6aCoreSnapshot({
    symbol,
    shortName: symbol,
    exchange: "NSE",
    kind: "EQ",
  }).ltp, 80);
}

export function phase6aAsChartCandles(symbol: string): Candle[] {
  return phase6aCandles(symbol).map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

function side(ltp: number, chg: number, oi: number, iv: number) {
  return { ltp, changePct: chg, oi, iv };
}

export function phase6aOptions(spot: number): OptionsSnapshot {
  const atm = Math.round(spot / 50) * 50;
  const rows = [];
  for (let i = -10; i <= 10; i += 1) {
    const strike = atm + i * 50;
    const dist = Math.abs(i);
    rows.push({
      source: PHASE6A_SOURCE,
      strike,
      atm: i === 0,
      call: side(round2(182 - dist * 12.4), i < 0 ? 1.8 - dist * 0.2 : -0.9 - dist * 0.1, 4_200_000 - dist * 180_000, 11.2 + dist * 0.35),
      put: side(round2(168 - dist * 11.1), i > 0 ? 1.4 - dist * 0.15 : -1.1 - dist * 0.12, 3_800_000 - dist * 150_000, 12.1 + dist * 0.4),
    });
  }
  return {
    source: PHASE6A_SOURCE,
    expiries: ["26 JUN 2026", "03 JUL 2026", "31 JUL 2026"],
    selectedExpiry: "26 JUN 2026",
    spot,
    pcr: 0.94,
    rows,
  };
}

export function phase6aFutures(symbol: string, spot: number): FuturesSnapshot {
  const prefix = symbol === "NIFTY 50" ? "NIFTY" : symbol === "NIFTY BANK" ? "BANKNIFTY" : symbol;
  return {
    source: PHASE6A_SOURCE,
    spot,
    volumeProfile: "Session",
    rows: [
      { source: PHASE6A_SOURCE, contract: `${prefix} JUN FUT`, ltp: round2(spot + 16.35), changeAbs: 22.1, basis: 16.35, oi: 12_400_000, volume: 2_180_000, buildup: "Long buildup" },
      { source: PHASE6A_SOURCE, contract: `${prefix} JUL FUT`, ltp: round2(spot + 41.8), changeAbs: 18.4, basis: 41.8, oi: 8_110_000, volume: 940_000, buildup: "Long buildup" },
      { source: PHASE6A_SOURCE, contract: `${prefix} AUG FUT`, ltp: round2(spot + 68.2), changeAbs: -4.2, basis: 68.2, oi: 3_220_000, volume: 410_000, buildup: "Short covering" },
    ],
    curveSlope: "Contango",
    nearBasis: 16.35,
    oiChangePct: 6.0,
    readThrough: "Long buildup",
  };
}

export const PHASE6A_ACTIVITY: ActivitySnapshot = {
  source: PHASE6A_SOURCE,
  events: [
    {
      source: PHASE6A_SOURCE,
      id: "a1",
      instrument: "INFY",
      event: "Relative volume expansion",
      description: "2.4x 20-day average · price above VWAP",
      value: "+1.38%",
      timestampLabel: "12:41:08",
      tone: "positive",
    },
    {
      source: PHASE6A_SOURCE,
      id: "a2",
      instrument: "ADANIENT",
      event: "OI build-up",
      description: "Price decline · fresh short interest",
      value: "18.6% OI",
      timestampLabel: "12:40:44",
      tone: "negative",
    },
    {
      source: PHASE6A_SOURCE,
      id: "a3",
      instrument: "RELIANCE",
      event: "Range acceptance",
      description: "Hold above prior session value",
      value: "+1.12%",
      timestampLabel: "12:39:21",
      tone: "positive",
    },
    {
      source: PHASE6A_SOURCE,
      id: "a4",
      instrument: "HDFCBANK",
      event: "Relative weakness",
      description: "Lag vs NIFTY · no volume confirmation",
      value: "-0.38%",
      timestampLabel: "12:38:55",
      tone: "negative",
    },
    {
      source: PHASE6A_SOURCE,
      id: "a5",
      instrument: "SBIN",
      event: "Neutral rotation",
      description: "Inside-day · OI unchanged",
      value: "+0.64%",
      timestampLabel: "12:37:12",
      tone: "neutral",
    },
  ],
  mix: { positive: 42, negative: 15, neutral: 11 },
  mostActive: "SBIN",
  highestVolume: "SBIN",
  largestOiDelta: "ADANIENT",
};

export function phase6aIntelligence(instrument: TerminalInstrument): IntelligenceSnapshot {
  return {
    source: PHASE6A_SOURCE,
    instrumentSymbol: instrument.symbol,
    bias: "Constructive",
    confidence: "Moderate",
    pooledLiveDays: 4,
    thresholdDays: 60,
    probability: null,
    probabilityReason: "Insufficient history",
    entry: {
      title: "Entry reasoning",
      body: `${instrument.shortName} holding above VWAP with constructive index breadth.`,
    },
    exit: {
      title: "Exit reasoning",
      body: "Trim into 24,680–24,720 if volume fails to confirm continuation.",
    },
    evidence: {
      title: "Supporting evidence",
      body: "Index +0.75% with relative volume expansion in selected leaders.",
    },
    contradictions: {
      title: "Contradictions",
      body: "HDFCBANK weakness versus the index keeps conviction moderate.",
    },
    keyLevels: [
      { label: "VWAP", value: "24,540" },
      { label: "Resistance", value: "24,680–24,720" },
      { label: "Support", value: "24,480" },
    ],
  };
}

export const PHASE6A_DEFAULT_INSTRUMENT = NIFTY;
