/**
 * Worker-owned REST access.
 *
 * Two jobs the Phase 5 stream cannot do:
 *  1. Initial state. `SqlitePollSource` keeps a process-global `_last` map and
 *     emits only *changed* fields, so a freshly connected client receives no
 *     snapshot. Without REST hydration a reconnect shows an empty terminal.
 *  2. Panels with no stream contract at all — option chain, futures book,
 *     unusual activity, candles.
 *
 * React never calls these; the worker is the single HTTP owner for live state.
 */

import type {
  ChartPoint,
  FuturesBook,
  FuturesResponse,
  OptionChain,
  OptionChainResponse,
  Quote,
  QuoteResponse,
  UnusualActivityResponse,
  UnusualActivityRow,
} from "../api/types";
import type { QuoteSnapshot } from "./marketCache";
import {
  asFiniteNumber,
  asMarketState,
  asNonEmptyString,
  asToken,
  isRecord,
  type AuxStatus,
  type CandleBar,
  type CandleSeries,
  type MarketState,
} from "./protocol";

export const REST_TIMEOUT_MS = 20_000;

/**
 * `data_state` rides on every pipeline envelope but is not modelled in
 * `api/types.ts`; declared structurally here rather than reshaping the shared
 * wire types for one consumer.
 */
interface DataStateShape {
  market_state?: string | null;
  data_status?: string | null;
  as_of?: string | null;
  reason?: string | null;
  source?: string | null;
  session_date?: string | null;
}

interface CandlesEnvelope {
  candles?: ChartPoint[] | null;
  candles_status?: string | null;
  candles_reason?: string | null;
  candles_source?: string | null;
  interval?: string | null;
}

export interface RestStateInfo {
  dataStatus: string | null;
  marketState: MarketState | null;
  asOf: string | null;
  reason: string | null;
  /** `data_state.session_date` when the envelope carries it. Not the calendar clock. */
  sessionDate?: string | null;
  source?: string | null;
}

export interface RestResult<T> extends RestStateInfo {
  status: AuxStatus;
  data: T | null;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim().replace(/\s+/g, " "));
}

/** Same-origin Next.js proxy. Upstream origin is `API_BASE_URL` on the server. */
async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readState(payload: unknown): RestStateInfo {
  const empty: RestStateInfo = {
    dataStatus: null,
    marketState: null,
    asOf: null,
    reason: null,
    sessionDate: null,
    source: null,
  };
  if (!isRecord(payload)) return empty;
  const raw = payload.data_state;
  if (!isRecord(raw)) return empty;
  const state = raw as DataStateShape;
  return {
    dataStatus: asNonEmptyString(state.data_status),
    marketState: state.market_state == null ? null : asMarketState(state.market_state),
    asOf: asNonEmptyString(state.as_of),
    reason: asNonEmptyString(state.reason),
    sessionDate: asNonEmptyString(state.session_date),
    source: asNonEmptyString(state.source),
  };
}

/* ------------------------------------------------------------------ */
/* Quotes — identity resolution and snapshot hydration                  */
/* ------------------------------------------------------------------ */

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Canonical backend fields win when they are present on the DTO, including a
 * present `null` (unavailable) or a present `0` (genuine zero). Legacy
 * `change` / `change_pct` are used only when the canonical key is absent.
 * Never derived from a locally assumed previous close.
 */
function canonicalOrLegacy(
  quote: Quote,
  canonical: "change_absolute" | "change_percent",
  legacy: "change" | "change_pct",
): number | null {
  if (hasOwn(quote, canonical)) {
    return asFiniteNumber(quote[canonical]);
  }
  return asFiniteNumber(quote[legacy]);
}

/**
 * `missing_fields` is the backend's own unavailable list. A listed field is
 * null even if the numeric slot is `0`. A `0` that is not listed stays `0`.
 * Equity OI=0 is not treated as missing unless the backend listed `oi`.
 */
function observedNumber(
  value: unknown,
  missing: readonly string[] | null | undefined,
  field: string,
): number | null {
  if (missing?.includes(field)) return null;
  return asFiniteNumber(value);
}

function observedDepthSide(
  value: unknown,
  missing: readonly string[] | null | undefined,
): number | null {
  if (missing?.includes("depth")) return null;
  return asFiniteNumber(value);
}

/** Exported for regression tests. Worker hydration is the only runtime caller. */
export function quoteToSnapshot(quote: Quote): QuoteSnapshot | null {
  const token = asToken(quote.instrument_token);
  if (token === null) return null;
  const missing = Array.isArray(quote.missing_fields) ? quote.missing_fields : null;
  return {
    token,
    meta: {
      symbol: asNonEmptyString(quote.symbol),
      exchange: asNonEmptyString(quote.exchange),
      instrumentType: asNonEmptyString(quote.instrument_type),
      lotSize: asFiniteNumber(quote.lot_size),
      tickSize: asFiniteNumber(quote.tick_size),
    },
    ltp: asFiniteNumber(quote.last_price),
    change: canonicalOrLegacy(quote, "change_absolute", "change"),
    changePct: canonicalOrLegacy(quote, "change_percent", "change_pct"),
    volume: observedNumber(quote.volume, missing, "volume"),
    oi: observedNumber(quote.oi, missing, "oi"),
    bid: observedDepthSide(quote.best_bid, missing),
    ask: observedDepthSide(quote.best_ask, missing),
    timestamp: asNonEmptyString(quote.timestamp),
  };
}

export async function fetchQuoteSnapshot(
  symbol: string,
): Promise<RestResult<QuoteSnapshot>> {
  const payload = await getJson(`/api/v1/quotes/${encodeSegment(symbol)}`);
  const state = readState(payload);
  if (!isRecord(payload)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "unreachable" };
  }
  const response = payload as unknown as QuoteResponse;
  const quote = response.quote;
  if (!response.found || !quote) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "not_found" };
  }
  const snapshot = quoteToSnapshot(quote);
  if (snapshot === null) {
    return { status: "unavailable", data: null, ...state, reason: "missing_instrument_token" };
  }
  return { status: "ok", data: snapshot, ...state };
}

/* ------------------------------------------------------------------ */
/* Aux panels                                                           */
/* ------------------------------------------------------------------ */

export async function fetchOptionChain(
  underlying: string,
  expiry: string | null,
): Promise<RestResult<OptionChain>> {
  const base = `/api/v1/options/${encodeSegment(underlying)}`;
  const path = expiry ? `${base}/${encodeSegment(expiry)}` : base;
  const payload = await getJson(path);
  const state = readState(payload);
  if (!isRecord(payload)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "unreachable" };
  }
  const response = payload as unknown as OptionChainResponse;
  if (!response.found || !response.chain) {
    return {
      status: "unavailable",
      data: null,
      ...state,
      reason: response.reason ?? state.reason ?? "not_found",
    };
  }
  return { status: "ok", data: response.chain, ...state };
}

export async function fetchFuturesBook(
  underlying: string,
): Promise<RestResult<FuturesBook>> {
  const payload = await getJson(`/api/v1/futures/${encodeSegment(underlying)}`);
  const state = readState(payload);
  if (!isRecord(payload)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "unreachable" };
  }
  const response = payload as unknown as FuturesResponse;
  if (!response.found || !response.futures) {
    return {
      status: "unavailable",
      data: null,
      ...state,
      reason: response.reason ?? state.reason ?? "not_found",
    };
  }
  return { status: "ok", data: response.futures, ...state };
}

export async function fetchUnusualActivity(
  limit: number,
): Promise<RestResult<UnusualActivityRow[]>> {
  const payload = await getJson(`/api/v1/unusual-activity?limit=${encodeURIComponent(String(limit))}`);
  const state = readState(payload);
  if (!isRecord(payload)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "unreachable" };
  }
  const rows = (payload as unknown as UnusualActivityResponse).unusual_activity;
  if (!Array.isArray(rows)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "no_rows" };
  }
  return { status: "ok", data: rows, ...state };
}

/* ------------------------------------------------------------------ */
/* Candles                                                              */
/* ------------------------------------------------------------------ */

function toBar(point: ChartPoint): CandleBar | null {
  const time = asNonEmptyString(point.timestamp);
  const open = asFiniteNumber(point.open);
  const high = asFiniteNumber(point.high);
  const low = asFiniteNumber(point.low);
  const close = asFiniteNumber(point.close);
  if (time === null || open === null || high === null || low === null || close === null) {
    return null;
  }
  const epoch = Date.parse(time);
  if (!Number.isFinite(epoch)) return null;
  return {
    time: Math.floor(epoch / 1000),
    open,
    high,
    low,
    close,
    volume: asFiniteNumber(point.volume),
  };
}

export async function fetchCandles(
  symbol: string,
  interval: string,
): Promise<RestResult<CandleSeries>> {
  const payload = await getJson(
    `/api/v1/candles/${encodeSegment(symbol)}?interval=${encodeURIComponent(interval)}`,
  );
  const state = readState(payload);
  if (!isRecord(payload)) {
    return { status: "unavailable", data: null, ...state, reason: state.reason ?? "unreachable" };
  }
  const response = payload as CandlesEnvelope;
  const bars = (response.candles ?? [])
    .map(toBar)
    .filter((bar): bar is CandleBar => bar !== null)
    .sort((a, b) => a.time - b.time);
  const series: CandleSeries = {
    interval: response.interval ?? interval,
    status: asNonEmptyString(response.candles_status),
    reason: asNonEmptyString(response.candles_reason),
    source: asNonEmptyString(response.candles_source),
    bars,
  };
  if (bars.length === 0) {
    return {
      status: "unavailable",
      data: series,
      ...state,
      reason: series.reason ?? state.reason ?? "no_bars",
    };
  }
  return { status: "ok", data: series, ...state };
}
