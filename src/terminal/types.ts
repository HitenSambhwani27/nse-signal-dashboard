/** Phase 6A terminal UI types. Not live market-data contracts. */

export const PHASE6A_SOURCE = "phase6a_ui_fixture" as const;

export type Phase6aSource = typeof PHASE6A_SOURCE;

export type WorkspaceId =
  | "core"
  | "options"
  | "futures"
  | "activity"
  | "intelligence"
  | "momentum"
  | "screener"
  | "alerts"
  | "portfolio";

export type InstrumentKind = "INDEX" | "EQ" | "FUT" | "OPT";

export type SignedTone = "up" | "down" | "neutral";

export type TimeframeId = "1m" | "5m" | "15m" | "1h" | "1D";

export type StrikeRangeId = 5 | 10 | 15;

export type BuildupLabel =
  | "Long buildup"
  | "Short buildup"
  | "Short covering"
  | "Long unwinding"
  | "Neutral";

export type ActivityTone = "positive" | "negative" | "neutral";

export type IntelligenceBias = "Constructive" | "Cautious" | "Neutral";

export type IntelligenceConfidence = "Low" | "Moderate" | "High";

export interface TerminalInstrument {
  symbol: string;
  shortName: string;
  exchange: "NSE";
  kind: InstrumentKind;
  token: number;
}

export interface MarketwatchRow {
  source: Phase6aSource;
  instrument: TerminalInstrument;
  ltp: number;
  changePct: number;
  volume: number | null;
  oi: number | null;
  bid: number | null;
  ask: number | null;
}

export interface IndexStripItem {
  source: Phase6aSource;
  label: string;
  changePct: number | null;
  last: number | null;
}

export interface CoreSnapshot {
  source: Phase6aSource;
  instrument: TerminalInstrument;
  ltp: number;
  changeAbs: number;
  changePct: number;
  marketStateLabel: string;
  tickSize: number;
  lotSize: number;
  updatedLabel: string;
}

export interface FixtureCandle {
  source: Phase6aSource;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionSideQuote {
  ltp: number;
  changePct: number;
  oi: number;
  iv: number;
}

export interface OptionChainRow {
  source: Phase6aSource;
  strike: number;
  atm: boolean;
  call: OptionSideQuote;
  put: OptionSideQuote;
}

export interface OptionsSnapshot {
  source: Phase6aSource;
  expiries: string[];
  selectedExpiry: string;
  spot: number;
  pcr: number;
  rows: OptionChainRow[];
}

export interface FuturesRow {
  source: Phase6aSource;
  contract: string;
  ltp: number;
  changeAbs: number;
  basis: number;
  oi: number;
  volume: number;
  buildup: BuildupLabel;
}

export interface FuturesSnapshot {
  source: Phase6aSource;
  spot: number;
  volumeProfile: string;
  rows: FuturesRow[];
  curveSlope: string;
  nearBasis: number;
  oiChangePct: number;
  readThrough: string;
}

export interface ActivityEvent {
  source: Phase6aSource;
  id: string;
  instrument: string;
  event: string;
  description: string;
  value: string;
  timestampLabel: string;
  tone: ActivityTone;
}

export interface ActivitySnapshot {
  source: Phase6aSource;
  events: ActivityEvent[];
  mix: { positive: number; negative: number; neutral: number };
  mostActive: string;
  highestVolume: string;
  largestOiDelta: string;
}

export interface IntelligenceSection {
  title: string;
  body: string;
}

export interface KeyLevel {
  label: string;
  value: string;
}

export interface IntelligenceSnapshot {
  source: Phase6aSource;
  instrumentSymbol: string;
  bias: IntelligenceBias;
  confidence: IntelligenceConfidence;
  pooledLiveDays: number;
  thresholdDays: number;
  probability: null;
  probabilityReason: string;
  entry: IntelligenceSection;
  exit: IntelligenceSection;
  evidence: IntelligenceSection;
  contradictions: IntelligenceSection;
  keyLevels: KeyLevel[];
}
