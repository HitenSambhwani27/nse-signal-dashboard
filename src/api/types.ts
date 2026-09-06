/** Shared TypeScript models matching the FastAPI /api/v1 envelope. */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface MaturityView {
  class_key?: string | null;
  envelope_key?: string | null;
  underlying?: string | null;
  tier?: string | null;
  pooled_live_days?: number | null;
  threshold_days?: number | null;
  suppress_below_days?: number | null;
  display?: string | null;
  probability_permitted?: boolean | null;
  probability?: number | null;
  reason?: string | null;
  note?: string | null;
}

export type MaturityMap = Record<string, MaturityView>;

export interface Envelope {
  maturity: MaturityMap;
  as_of: string | null;
}

export interface OhlcBlock {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface Quote {
  symbol: string | null;
  instrument_token?: number | null;
  exchange?: string | null;
  timestamp: string | null;
  last_price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_delta: number | null;
  oi: number | null;
  oi_change: number | null;
  oi_change_pct: number | null;
  last_quantity: number | null;
  average_price: number | null;
  best_bid: number | null;
  best_ask: number | null;
  best_bid_quantity: number | null;
  best_ask_quantity: number | null;
  spread: number | null;
  mid_price: number | null;
  buy_quantity: number | null;
  sell_quantity: number | null;
  displayed_bid_quantity: number | null;
  displayed_ask_quantity: number | null;
  bid_depth_5: number | null;
  ask_depth_5: number | null;
  depth_imbalance: number | null;
  ohlc: OhlcBlock | null;
  instrument_type?: string | null;
  underlying?: string | null;
  expiry?: string | null;
  strike?: number | null;
  lot_size?: number | null;
  tick_size?: number | null;
  subscribe_mode?: string | null;
  exchange_timestamp?: string | null;
  last_trade_time?: string | null;
  ingested_at?: string | null;
  missing_fields?: string[] | null;
  kind?: string | null;
}

export interface QuoteResponse extends Envelope {
  found: boolean;
  quote: Quote | null;
}

export interface OptionSide {
  symbol?: string | null;
  ltp: number | null;
  price_change: number | null;
  price_change_pct: number | null;
  volume: number | null;
  volume_delta: number | null;
  oi: number | null;
  oi_change: number | null;
  oi_change_pct: number | null;
  last_quantity: number | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  mid_price: number | null;
  bid_depth_5: number | null;
  ask_depth_5: number | null;
  depth_imbalance: number | null;
  lot_size?: number | null;
  tick_size?: number | null;
  moneyness?: string | null;
  iv?: number | null;
  iv_pct?: number | null;
  iv_source?: string | null;
  iv_kind?: string | null;
  iv_status?: string | null;
  iv_reason?: string | null;
  iv_model?: string | null;
  iv_rate?: number | null;
  iv_dividend_yield?: number | null;
  iv_exercise_style?: string | null;
}

export interface OptionStrikeRow {
  strike: number;
  distance_from_atm: number | null;
  ce: OptionSide | null;
  pe: OptionSide | null;
}

export interface ExtremeStrike {
  strike: number;
  symbol?: string | null;
  oi?: number | null;
  oi_change?: number | null;
}

export interface MaxPain {
  max_pain_strike: number | null;
  expiry: string | null;
  number_of_strikes: number | null;
  chain_completeness: number | null;
  status: string | null;
  kind?: string | null;
}

export interface MultiStrikeRow {
  strike: number;
  ce_oi: number | null;
  pe_oi: number | null;
  ce_oi_change: number | null;
  pe_oi_change: number | null;
  ce_volume: number | null;
  pe_volume: number | null;
  ce_last_quantity: number | null;
  pe_last_quantity: number | null;
  ce_depth_imbalance: number | null;
  pe_depth_imbalance: number | null;
}

export type ChainStatus = "complete" | "partial" | "truncated" | "empty" | string;

export interface OptionChain {
  underlying: string | null;
  expiry: string | null;
  spot: number | null;
  atm: number | null;
  atm_method?: string | null;
  strike_interval?: number | null;
  chain_completeness: number | null;
  complete: boolean | null;
  chain_status: ChainStatus | null;
  eligible_contract_count: number | null;
  selected_contract_count: number | null;
  missing_contract_count: number | null;
  quoted_contract_count?: number | null;
  quote_coverage?: number | null;
  quote_status?: ChainStatus | null;
  truncated: boolean | null;
  partial: boolean | null;
  observation_count?: number | null;
  observation_completeness?: number | null;
  number_of_strikes: number | null;
  pcr_oi: number | null;
  pcr_volume: number | null;
  pcr_near_atm_oi: number | null;
  pcr_window_strikes?: number | null;
  total_ce_oi: number | null;
  total_pe_oi: number | null;
  highest_ce_oi: ExtremeStrike | null;
  highest_pe_oi: ExtremeStrike | null;
  largest_ce_oi_increase: ExtremeStrike | null;
  largest_pe_oi_increase: ExtremeStrike | null;
  largest_ce_oi_decrease: ExtremeStrike | null;
  largest_pe_oi_decrease: ExtremeStrike | null;
  max_pain: MaxPain | null;
  multi_strike: MultiStrikeRow[] | null;
  strikes: OptionStrikeRow[] | null;
  available_expiries?: string[] | null;
  found?: boolean | null;
  kind?: string | null;
}

export interface OptionChainResponse extends Envelope {
  found: boolean | null;
  chain: OptionChain | null;
  reason?: string | null;
}

export interface OptionOiBlock {
  underlying: string | null;
  expiry: string | null;
  atm: number | null;
  pcr_oi: number | null;
  pcr_volume: number | null;
  pcr_near_atm_oi: number | null;
  total_ce_oi: number | null;
  total_pe_oi: number | null;
  highest_ce_oi: ExtremeStrike | null;
  highest_pe_oi: ExtremeStrike | null;
  largest_ce_oi_increase: ExtremeStrike | null;
  largest_pe_oi_increase: ExtremeStrike | null;
  largest_ce_oi_decrease: ExtremeStrike | null;
  largest_pe_oi_decrease: ExtremeStrike | null;
  max_pain: MaxPain | null;
  chain_completeness: number | null;
  chain_status: ChainStatus | null;
  eligible_contract_count: number | null;
  selected_contract_count: number | null;
  missing_contract_count: number | null;
  quoted_contract_count?: number | null;
  quote_coverage?: number | null;
  quote_status?: ChainStatus | null;
  truncated: boolean | null;
  multi_strike: MultiStrikeRow[] | null;
}

export interface OptionOiResponse extends Envelope {
  found: boolean | null;
  oi: OptionOiBlock | null;
}

export interface UnusualBlock {
  activity_level: string | null;
  activity_score: number | null;
  reasons: string[] | null;
  kind?: string | null;
  note?: string | null;
}

export interface OptionActivityRow {
  strike: number | null;
  side: string | null;
  symbol: string | null;
  unusual: UnusualBlock | null;
  volume_level: string | null;
  large_trade: string | null;
}

export interface OptionActivityResponse extends Envelope {
  found: boolean | null;
  activity: OptionActivityRow[] | null;
  expiry: string | null;
}

export interface PriceOiInterpretation {
  label: string | null;
  pattern: string | null;
  kind?: string | null;
  note?: string | null;
}

export interface FuturesContract {
  symbol: string | null;
  underlying: string | null;
  expiry: string | null;
  lot_size: number | null;
  tick_size: number | null;
  ltp: number | null;
  price_change: number | null;
  price_change_pct: number | null;
  volume: number | null;
  volume_delta: number | null;
  oi: number | null;
  oi_change: number | null;
  oi_change_pct: number | null;
  last_quantity: number | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  mid_price: number | null;
  bid_depth_5: number | null;
  ask_depth_5: number | null;
  depth_imbalance: number | null;
  spot_symbol: string | null;
  spot: number | null;
  spot_as_of: string | null;
  futures_as_of: string | null;
  data_age_seconds: number | null;
  basis: number | null;
  basis_pct: number | null;
  basis_status: "fresh" | "stale" | "missing" | string | null;
  price_oi: PriceOiInterpretation | null;
  kind?: string | null;
}

export interface FuturesBook {
  underlying: string | null;
  spot: number | null;
  spot_symbol: string | null;
  spot_as_of: string | null;
  contracts: FuturesContract[] | null;
  found: boolean | null;
  kind?: string | null;
}

export interface FuturesResponse extends Envelope {
  found: boolean | null;
  futures: FuturesBook | null;
  reason?: string | null;
}

export interface MarketActivityRow {
  timestamp: string | null;
  instrument: string | null;
  price: number | null;
  last_quantity: number | null;
  trade_notional: number | null;
  trade_size_lots: number | null;
  volume: number | null;
  volume_delta: number | null;
  oi: number | null;
  oi_delta: number | null;
  best_bid: number | null;
  best_ask: number | null;
  mid: number | null;
  spread: number | null;
  bid_depth: number | null;
  ask_depth: number | null;
  depth_imbalance: number | null;
  trade_notional_percentile: number | null;
  trade_size_percentile: number | null;
  large_trade: string | null;
  volume_rate: number | null;
  baseline_volume_rate: number | null;
  volume_ratio: number | null;
  volume_level: string | null;
  activity_rate: number | null;
  baseline_activity_rate: number | null;
  activity_ratio: number | null;
  activity_level: string | null;
  baseline_available: boolean | null;
  tod_bucket: string | null;
  kind?: string | null;
  note?: string | null;
}

export interface AggressiveProxy {
  label: string | null;
  last_price?: number | null;
  best_bid?: number | null;
  best_ask?: number | null;
  tolerance_bps?: number | null;
  kind?: string | null;
  note?: string | null;
}

export interface DisplayedDepthChanges {
  bid_quantity_added: number | null;
  bid_quantity_removed: number | null;
  ask_quantity_added: number | null;
  ask_quantity_removed: number | null;
  depth_imbalance_change: number | null;
  spread_change: number | null;
  best_bid_movement: number | null;
  best_ask_movement: number | null;
  kind?: string | null;
  note?: string | null;
}

export interface MarketActivityResponse extends Envelope {
  found: boolean;
  activity: MarketActivityRow | null;
  aggressive_proxy?: AggressiveProxy | null;
  displayed_depth_changes?: DisplayedDepthChanges | null;
  liquidity_events?: string[] | null;
  price_impact?: string | null;
  unusual?: UnusualBlock | null;
  quote?: Quote | null;
}

export interface UnusualActivityRow extends UnusualBlock {
  symbol: string | null;
  liquidity_events?: string[] | null;
  aggressive_proxy?: string | null;
  price?: number | null;
  change?: number | null;
  volume?: number | null;
  last_quantity?: number | null;
  trade_notional?: number | null;
  trade_size_percentile?: number | null;
  depth_imbalance?: number | null;
  timestamp?: string | null;
}

export interface UnusualActivityResponse extends Envelope {
  unusual_activity: UnusualActivityRow[] | null;
}

export interface ChartPoint {
  timestamp: string | null;
  last_price?: number | null;
  volume?: number | null;
  oi?: number | null;
  oi_delta?: number | null;
  volume_delta?: number | null;
  trade_notional?: number | null;
  depth_imbalance?: number | null;
  spread?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

export interface ChartSeries {
  points: ChartPoint[] | null;
  candles?: ChartPoint[] | null;
  candles_status?: string | null;
  candles_reason?: string | null;
  candles_source?: string | null;
  interval?: string | null;
  source?: string | null;
  observation_count: number | null;
  returned_points: number | null;
  downsampled: boolean | null;
  kind?: string | null;
}

export interface ChartsResponse extends Envelope {
  found: boolean;
  chart: ChartSeries | null;
}

export interface Watchlist {
  id: number | null;
  name: string | null;
  created_at: string | null;
  symbols: string[] | null;
}

export interface WatchlistsResponse extends Envelope {
  watchlists: Watchlist[] | null;
}

export interface WatchlistQuoteRow {
  symbol: string;
  quote: Quote | null;
  found: boolean;
}

export interface WatchlistQuotesResponse extends Envelope {
  quotes: WatchlistQuoteRow[] | null;
}

export interface CrossMarketOptionsSummary {
  expiry: string | null;
  pcr_oi: number | null;
  atm: number | null;
  chain_completeness: number | null;
  chain_status: ChainStatus | null;
  eligible_contract_count: number | null;
  selected_contract_count: number | null;
  missing_contract_count: number | null;
  quoted_contract_count?: number | null;
  quote_coverage?: number | null;
  quote_status?: ChainStatus | null;
}

export interface CrossMarketPayload {
  underlying: string | null;
  relationships: string[] | null;
  kind?: string | null;
  note?: string | null;
  futures: FuturesBook | null;
  options_summary: CrossMarketOptionsSummary | null;
}

export interface CrossMarketResponse extends Envelope {
  found: boolean | null;
  cross_market: CrossMarketPayload | null;
  reason?: string | null;
}

export interface HealthBlob {
  last_ingestion_meta?: {
    timestamp?: string | null;
    event_type?: string | null;
    message?: string | null;
  } | null;
  last_compact?: unknown;
  last_coverage?: unknown;
  last_feature_trade_date?: string | null;
  last_live_feature_trade_date?: string | null;
  last_live_signal_trade_date?: string | null;
  processing_status?: Record<string, { job?: string; status?: string; last_trade_date?: string | null }>;
  decision_count?: number | null;
  fill_count?: number | null;
  api?: string | null;
  database?: string | null;
  processing_lag?: string | null;
  instrument_cache?: {
    status?: string | null;
    reason?: string | null;
    nifty_spot?: boolean;
    banknifty_spot?: boolean;
  } | null;
}

export interface HealthResponse extends Envelope {
  health: HealthBlob | null;
}

export interface OverviewResponse extends Envelope {
  last_ingest?: {
    timestamp?: string | null;
    event_type?: string | null;
    message?: string | null;
  } | null;
  last_feature?: string | null;
  last_signal?: string | null;
  processing_status?: HealthBlob["processing_status"];
  signal_counts?: Record<string, number> | null;
}

export interface SignalRow {
  id?: number | null;
  timestamp?: string | null;
  trade_date?: string | null;
  symbol?: string | null;
  track?: string | null;
  display?: string | null;
  probability?: number | null;
  score?: number | null;
  tier?: string | null;
  reason?: string | null;
  probability_permitted?: boolean | null;
}

export interface SignalsResponse extends Envelope {
  signals: SignalRow[] | null;
}

export interface AccountResponse extends Envelope {
  positions: unknown;
  margins: unknown;
  fills: unknown[] | null;
}

export interface DecisionsResponse extends Envelope {
  decisions: unknown[] | null;
  class_counts: Record<string, number> | null;
}

export type MaturityResponse = Envelope;
