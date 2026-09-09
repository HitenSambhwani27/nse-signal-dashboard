/**
 * Phase 6B worker/client message protocol.
 *
 * Mirrors the Phase 5 SSE contract (`/api/v1/stream`) as it is actually
 * implemented in `nse_pipeline.live.frames` / `nse_pipeline.live.stream`.
 * Nothing here invents a field the backend does not send.
 */

import type {
  FuturesBook,
  OptionChain,
  UnusualActivityRow,
} from "../api/types";

export const WORKER_PROTOCOL_VERSION = 1;

/** Phase 5 caps: `StreamSettings.max_instruments_per_connection`. */
export const MAX_TOKENS_PER_CONNECTION = 250;

/** Phase 5 `frames.GROUPS` subset the terminal needs. */
export const STREAM_GROUPS = "price,volume,oi,depth,quality" as const;

/* ------------------------------------------------------------------ */
/* Phase 5 wire shapes                                                  */
/* ------------------------------------------------------------------ */

/** `nse_pipeline.market.calendar` clock states. */
export type MarketState =
  | "pre_open"
  | "open"
  | "post_close"
  | "closed"
  | "weekend"
  | "holiday"
  | "unknown";

/**
 * `session_coverage_label` returns "PARTIAL_SESSION" or null. It never claims
 * a full session, so there is no FULL_SESSION member.
 */
export type SessionCoverage = "PARTIAL_SESSION" | null;

/** Resync reasons emitted by `stream.py` and `source.py`. */
export type ResyncReason =
  | "unavailable_continuity"
  | "stream_process_restart"
  | "ingestion_restart"
  | "stream_overflow"
  | "unknown";

export interface SessionState {
  marketState: MarketState;
  sessionDate: string | null;
  coverage: SessionCoverage;
  /** Null on every stream frame — `_session_snapshot` never sets it. REST does. */
  dataStatus: string | null;
  liveDataExpected: boolean | null;
  asOf: string | null;
}

export interface ResyncState {
  reason: ResyncReason;
  rawReason: string;
  fromSeq: number | null;
  at: number;
}

/* ------------------------------------------------------------------ */
/* Normalized market state                                              */
/* ------------------------------------------------------------------ */

/** Where a field's current value came from. Never blended, never guessed. */
export type ValueOrigin = "stream" | "snapshot" | "none";

export interface InstrumentMeta {
  symbol: string | null;
  exchange: string | null;
  instrumentType: string | null;
  lotSize: number | null;
  tickSize: number | null;
}

/**
 * One instrument's live state. Every field is nullable because the Phase 5
 * stream sends field-level deltas — an absent field means "not observed",
 * which is not the same as zero.
 */
export interface InstrumentState {
  token: number;
  meta: InstrumentMeta;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  oi: number | null;
  bid: number | null;
  ask: number | null;
  /** Exchange timestamp from the tick (`ts`) or the REST snapshot. */
  timestamp: string | null;
  /** Highest applied global `seq`. Null until a tick lands. */
  seq: number | null;
  /** Client clock at apply time, for freshness only. Never shown as a quote time. */
  receivedAt: number | null;
  origin: ValueOrigin;
}

export function emptyInstrumentState(token: number): InstrumentState {
  return {
    token,
    meta: {
      symbol: null,
      exchange: null,
      instrumentType: null,
      lotSize: null,
      tickSize: null,
    },
    ltp: null,
    change: null,
    changePct: null,
    volume: null,
    oi: null,
    bid: null,
    ask: null,
    timestamp: null,
    seq: null,
    receivedAt: null,
    origin: "none",
  };
}

/* ------------------------------------------------------------------ */
/* Stream health                                                        */
/* ------------------------------------------------------------------ */

/**
 * Transport status. `stale` means the connection is open but frames stopped
 * arriving within the server-advertised heartbeat budget — it is a transport
 * observation, not a claim about market data quality.
 */
export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "stale"
  | "disconnected";

export interface StreamHealth {
  status: StreamStatus;
  connectionId: string | null;
  /** Last `id:` seen on a tick. Replayed as `Last-Event-ID` on reconnect. */
  lastEventId: string | null;
  lastFrameAt: number | null;
  lastHeartbeatAt: number | null;
  lastTickAt: number | null;
  /** `hello.heartbeat_ms`. Drives the staleness budget; not a local invention. */
  heartbeatMs: number | null;
  /** `heartbeat.lag_ms` — server-measured ingest lag. Not a transport latency. */
  lagMs: number | null;
  subscribedTokens: number;
  maxInstruments: number | null;
  schemaVersion: string | null;
  /** Tokens the server explicitly rejected in `hello.rejected`. */
  rejectedTokens: number;
  resync: ResyncState | null;
  attempt: number;
  /** Populated for admission failures (503 capacity, 400 bad tokens). */
  error: string | null;
  retryAfterMs: number | null;
}

export function initialStreamHealth(): StreamHealth {
  return {
    status: "idle",
    connectionId: null,
    lastEventId: null,
    lastFrameAt: null,
    lastHeartbeatAt: null,
    lastTickAt: null,
    heartbeatMs: null,
    lagMs: null,
    subscribedTokens: 0,
    maxInstruments: null,
    schemaVersion: null,
    rejectedTokens: 0,
    resync: null,
    attempt: 0,
    error: null,
    retryAfterMs: null,
  };
}

/* ------------------------------------------------------------------ */
/* Worker-owned REST projections                                        */
/* ------------------------------------------------------------------ */

/**
 * REST-backed panels. The Phase 5 stream carries per-token ticks only, so the
 * option chain, futures book, unusual-activity feed and candles have no stream
 * contract and are hydrated by the worker instead of by each component.
 */
export type AuxKind = "options" | "futures" | "activity" | "candles";

export type AuxStatus = "idle" | "loading" | "ok" | "unavailable";

export interface AuxMeta {
  key: string;
  status: AuxStatus;
  /** Backend `data_state.data_status` verbatim, so panels stay honest. */
  dataStatus: string | null;
  marketState: MarketState | null;
  asOf: string | null;
  reason: string | null;
  updatedAt: number | null;
}

/** Wire DTOs are already the backend's canonical shapes; they are not re-invented. */
export type AuxEntry =
  | (AuxMeta & { kind: "options"; data: OptionChain | null })
  | (AuxMeta & { kind: "futures"; data: FuturesBook | null })
  | (AuxMeta & { kind: "activity"; data: UnusualActivityRow[] | null })
  | (AuxMeta & { kind: "candles"; data: CandleSeries | null });

/** Normalized candle payload from `/api/v1/candles`. */
export interface CandleSeries {
  interval: string;
  status: string | null;
  reason: string | null;
  source: string | null;
  bars: CandleBar[];
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export function auxId(kind: AuxKind, key: string): string {
  return `${kind}:${key}`;
}

/* ------------------------------------------------------------------ */
/* Client -> worker                                                     */
/* ------------------------------------------------------------------ */

export interface ClientHelloMessage {
  type: "client_hello";
  protocolVersion: number;
}

/** Ref-counted. The worker unions tokens across every port. */
export interface SubscribeMessage {
  type: "subscribe";
  consumer: string;
  tokens: number[];
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  consumer: string;
  tokens: number[];
}

/** Resolve symbols to tokens + seed state from REST. There is no /instruments route. */
export interface ResolveMessage {
  type: "resolve";
  symbols: string[];
}

export interface AuxRequestMessage {
  type: "aux_request";
  kind: AuxKind;
  key: string;
}

export interface AuxReleaseMessage {
  type: "aux_release";
  kind: AuxKind;
  key: string;
}

export interface SnapshotRequestMessage {
  type: "snapshot_request";
}

export interface ClientCloseMessage {
  type: "client_close";
}

/** MessagePorts have no close event, so liveness is explicit. */
export interface ClientPingMessage {
  type: "client_ping";
}

export type ClientMessage =
  | ClientHelloMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | ResolveMessage
  | AuxRequestMessage
  | AuxReleaseMessage
  | SnapshotRequestMessage
  | ClientPingMessage
  | ClientCloseMessage;

/* ------------------------------------------------------------------ */
/* Worker -> client                                                     */
/* ------------------------------------------------------------------ */

export interface WorkerReadyMessage {
  type: "worker_ready";
  protocolVersion: number;
  workerId: string;
  portCount: number;
}

export interface SnapshotMessage {
  type: "snapshot";
  instruments: InstrumentState[];
  health: StreamHealth;
  session: SessionState | null;
  /** Resolved symbol -> token, so panels never guess a token. */
  tokensBySymbol: Record<string, number>;
  aux: AuxEntry[];
}

export interface InstrumentsMessage {
  type: "instruments";
  updates: InstrumentState[];
}

export interface HealthMessage {
  type: "health";
  health: StreamHealth;
}

export interface SessionMessage {
  type: "session";
  session: SessionState;
}

export interface ResolvedMessage {
  type: "resolved";
  tokensBySymbol: Record<string, number>;
  unresolved: string[];
}

export interface AuxMessage {
  type: "aux";
  entry: AuxEntry;
}

export interface WorkerErrorMessage {
  type: "worker_error";
  scope: "stream" | "rest" | "protocol";
  message: string;
}

export type WorkerMessage =
  | WorkerReadyMessage
  | SnapshotMessage
  | InstrumentsMessage
  | HealthMessage
  | SessionMessage
  | ResolvedMessage
  | AuxMessage
  | WorkerErrorMessage;

/* ------------------------------------------------------------------ */
/* Guards — malformed input must never reach the cache (§32)            */
/* ------------------------------------------------------------------ */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function asToken(value: unknown): number | null {
  const num = asFiniteNumber(value);
  if (num === null) return null;
  const int = Math.trunc(num);
  return int > 0 ? int : null;
}

export function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

const MARKET_STATES: ReadonlySet<string> = new Set([
  "pre_open",
  "open",
  "post_close",
  "closed",
  "weekend",
  "holiday",
  "unknown",
]);

export function asMarketState(value: unknown): MarketState {
  return typeof value === "string" && MARKET_STATES.has(value)
    ? (value as MarketState)
    : "unknown";
}

const RESYNC_REASONS: ReadonlySet<string> = new Set([
  "unavailable_continuity",
  "stream_process_restart",
  "ingestion_restart",
  "stream_overflow",
]);

export function asResyncReason(value: unknown): ResyncReason {
  return typeof value === "string" && RESYNC_REASONS.has(value)
    ? (value as ResyncReason)
    : "unknown";
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "client_hello":
    case "snapshot_request":
    case "client_ping":
    case "client_close":
      return true;
    case "subscribe":
    case "unsubscribe":
      return typeof value.consumer === "string" && Array.isArray(value.tokens);
    case "resolve":
      return Array.isArray(value.symbols);
    case "aux_request":
    case "aux_release":
      return typeof value.kind === "string" && typeof value.key === "string";
    default:
      return false;
  }
}
