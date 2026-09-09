/**
 * Worker-side coordinator: ports, subscriptions, stream lifecycle, cache and
 * REST hydration. Kept free of worker globals so it can be unit tested with
 * mocked frames and a mocked REST layer (§36).
 */

import type { FuturesBook, OptionChain, UnusualActivityRow } from "../api/types";
import { MarketCache, decodeSession, type QuoteSnapshot } from "./marketCache";
import {
  MAX_TOKENS_PER_CONNECTION,
  WORKER_PROTOCOL_VERSION,
  asFiniteNumber,
  asNonEmptyString,
  asResyncReason,
  asToken,
  auxId,
  initialStreamHealth,
  isClientMessage,
  isRecord,
  type AuxEntry,
  type AuxKind,
  type AuxMeta,
  type CandleSeries,
  type ClientMessage,
  type SessionState,
  type StreamHealth,
  type StreamStatus,
  type WorkerMessage,
} from "./protocol";
import type { RestResult } from "./rest";
import { decodeFrameData, type SseFrame } from "./sse";

/** Batch window. The backend polls at 1 Hz, so this only coalesces bursts. */
export const FLUSH_INTERVAL_MS = 80;
/** Freshness budget as a multiple of the server-advertised `heartbeat_ms`. */
export const STALE_HEARTBEAT_MULTIPLIER = 2.5;
export const WATCHDOG_INTERVAL_MS = 1_000;
/** Ports that stop pinging are reaped; MessagePort has no close event. */
export const PORT_TIMEOUT_MS = 60_000;
/** Only while the session is open — a closed market has nothing to re-poll. */
export const AUX_REFRESH_MS = 30_000;
export const ACTIVITY_LIMIT = 50;

export interface PortLike {
  postMessage(message: WorkerMessage): void;
}

export interface HubConnection {
  start(): void;
  stop(): void;
  setTokens(tokens: number[]): void;
  getLastEventId(): string | null;
}

export interface HubRest {
  fetchQuoteSnapshot(symbol: string): Promise<RestResult<QuoteSnapshot>>;
  fetchOptionChain(underlying: string, expiry: string | null): Promise<RestResult<OptionChain>>;
  fetchFuturesBook(underlying: string): Promise<RestResult<FuturesBook>>;
  fetchUnusualActivity(limit: number): Promise<RestResult<UnusualActivityRow[]>>;
  fetchCandles(symbol: string, interval: string): Promise<RestResult<CandleSeries>>;
}

export interface HubDeps {
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  rest: HubRest;
  workerId: string;
}

interface PortRecord {
  id: number;
  port: PortLike;
  tokens: Map<number, number>;
  aux: Map<string, number>;
  lastSeenAt: number;
}

interface AuxRecord {
  entry: AuxEntry;
  refs: number;
  timer: number | null;
  inflight: boolean;
}

export class StreamHub {
  private readonly cache = new MarketCache();
  private readonly ports = new Map<number, PortRecord>();
  private readonly aux = new Map<string, AuxRecord>();
  private readonly tokenToSymbol = new Map<number, string>();
  private health = initialStreamHealth();
  private connection: HubConnection | null = null;
  private nextPortId = 1;
  private flushTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private hydrating = false;
  /** Tokens waiting for a REST snapshot, drained one at a time. */
  private readonly hydrateQueue = new Set<number>();
  /** Snapshots already paid for during identity resolution. */
  private readonly seedSnapshots = new Map<number, QuoteSnapshot>();

  constructor(
    private readonly deps: HubDeps,
    private readonly createConnection: (hub: StreamHub) => HubConnection,
  ) {}

  /* ---------------- ports ---------------- */

  attach(port: PortLike): number {
    const id = this.nextPortId++;
    this.ports.set(id, {
      id,
      port,
      tokens: new Map(),
      aux: new Map(),
      lastSeenAt: this.deps.now(),
    });
    this.send(port, {
      type: "worker_ready",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      workerId: this.deps.workerId,
      portCount: this.ports.size,
    });
    this.sendSnapshot(port);
    this.ensureWatchdog();
    return id;
  }

  detach(portId: number): void {
    const record = this.ports.get(portId);
    if (!record) return;
    for (const [token, count] of record.tokens) {
      this.cache.release(new Array<number>(count).fill(token));
    }
    for (const [key, count] of record.aux) {
      for (let i = 0; i < count; i += 1) this.releaseAux(key);
    }
    this.ports.delete(portId);
    this.syncTokens();
    if (this.ports.size === 0) this.shutdownStream();
  }

  portCount(): number {
    return this.ports.size;
  }

  /* ---------------- inbound ---------------- */

  handleMessage(portId: number, raw: unknown): void {
    const record = this.ports.get(portId);
    if (!record) return;
    record.lastSeenAt = this.deps.now();
    if (!isClientMessage(raw)) {
      this.send(record.port, {
        type: "worker_error",
        scope: "protocol",
        message: "unrecognised_client_message",
      });
      return;
    }
    const message: ClientMessage = raw;
    switch (message.type) {
      case "client_hello":
        this.send(record.port, {
          type: "worker_ready",
          protocolVersion: WORKER_PROTOCOL_VERSION,
          workerId: this.deps.workerId,
          portCount: this.ports.size,
        });
        break;
      case "client_ping":
        break;
      case "subscribe":
        this.subscribe(record, message.tokens);
        break;
      case "unsubscribe":
        this.unsubscribe(record, message.tokens);
        break;
      case "resolve":
        void this.resolve(record, message.symbols);
        break;
      case "aux_request":
        this.requestAux(record, message.kind, message.key);
        break;
      case "aux_release":
        this.releaseAuxFor(record, message.kind, message.key);
        break;
      case "snapshot_request":
        this.sendSnapshot(record.port);
        break;
      case "client_close":
        this.detach(portId);
        break;
    }
  }

  /* ---------------- subscriptions ---------------- */

  private subscribe(record: PortRecord, rawTokens: number[]): void {
    const tokens = normalizeTokens(rawTokens);
    if (tokens.length === 0) return;
    const fresh: number[] = [];
    for (const token of tokens) {
      if (this.cache.refCount(token) === 0) fresh.push(token);
      record.tokens.set(token, (record.tokens.get(token) ?? 0) + 1);
    }
    this.cache.retain(tokens);
    this.syncTokens();
    if (fresh.length > 0) void this.hydrateTokens(fresh);
  }

  private unsubscribe(record: PortRecord, rawTokens: number[]): void {
    const tokens = normalizeTokens(rawTokens);
    const releasable: number[] = [];
    for (const token of tokens) {
      const held = record.tokens.get(token) ?? 0;
      if (held <= 0) continue;
      if (held === 1) record.tokens.delete(token);
      else record.tokens.set(token, held - 1);
      releasable.push(token);
    }
    if (releasable.length === 0) return;
    this.cache.release(releasable);
    this.syncTokens();
  }

  /**
   * Phase 5 takes the subscription set as a query parameter, so a token change
   * means a reconnect. `StreamConnection.setTokens` no-ops on an unchanged set,
   * which keeps Marketwatch + Core sharing one token from churning the stream.
   */
  private syncTokens(): void {
    const tokens = this.cache.subscribedTokens();
    if (tokens.length === 0) {
      this.shutdownStream();
      this.patchHealth({ status: "idle", subscribedTokens: 0 });
      return;
    }
    if (this.connection === null) {
      this.connection = this.createConnection(this);
      this.connection.setTokens(tokens);
      this.connection.start();
    } else {
      this.connection.setTokens(tokens);
    }
    this.patchHealth({ subscribedTokens: Math.min(tokens.length, MAX_TOKENS_PER_CONNECTION) });
  }

  private shutdownStream(): void {
    if (this.connection === null) return;
    this.connection.stop();
    this.connection = null;
  }

  /* ---------------- identity + hydration ---------------- */

  private async resolve(record: PortRecord, symbols: string[]): Promise<void> {
    const wanted = symbols.filter((s): s is string => typeof s === "string" && s.trim() !== "");
    const unresolved: string[] = [];
    const resolved: Record<string, number> = {};
    for (const symbol of wanted) {
      const known = this.cache.tokenForSymbol(symbol);
      if (known !== null) {
        resolved[symbol] = known;
        continue;
      }
      const result = await this.deps.rest.fetchQuoteSnapshot(symbol);
      if (result.status !== "ok" || result.data === null) {
        unresolved.push(symbol);
        continue;
      }
      this.applyRestState(result);
      const snapshot = result.data;
      this.cache.mapSymbol(symbol, snapshot.token);
      this.tokenToSymbol.set(snapshot.token, symbol);
      resolved[symbol] = snapshot.token;
      if (this.cache.refCount(snapshot.token) > 0) {
        this.cache.hydrate(snapshot, this.deps.now());
      } else {
        // Panels subscribe only once they know the token, so hold this snapshot
        // for that first subscribe instead of fetching the same quote twice.
        this.seedSnapshots.set(snapshot.token, snapshot);
      }
    }
    this.send(record.port, { type: "resolved", tokensBySymbol: resolved, unresolved });
    this.scheduleFlush();
  }

  /**
   * Re-read REST state for the given tokens. Used on first subscribe and after
   * any continuity break, because Phase 5 never backfills a gap (§23, §24).
   */
  private async hydrateTokens(tokens: number[]): Promise<void> {
    for (const token of tokens) this.hydrateQueue.add(token);
    // Serialize rather than drop: 19 Marketwatch rows subscribe independently
    // and every one of them still has to end up hydrated.
    if (this.hydrating) return;
    this.hydrating = true;
    try {
      while (this.hydrateQueue.size > 0) {
        const token = this.hydrateQueue.values().next().value as number;
        this.hydrateQueue.delete(token);
        if (this.cache.refCount(token) === 0) continue;

        const seed = this.seedSnapshots.get(token);
        if (seed !== undefined) {
          this.seedSnapshots.delete(token);
          this.cache.hydrate(seed, this.deps.now());
          this.scheduleFlush();
          continue;
        }

        const symbol = this.tokenToSymbol.get(token);
        if (symbol === undefined) continue;
        const result = await this.deps.rest.fetchQuoteSnapshot(symbol);
        if (result.status !== "ok" || result.data === null) continue;
        this.applyRestState(result);
        this.cache.hydrate(result.data, this.deps.now());
        this.scheduleFlush();
      }
    } finally {
      this.hydrating = false;
    }
  }

  /* ---------------- stream frames ---------------- */

  onConnecting(attempt: number): void {
    const status: StreamStatus = attempt > 1 ? "reconnecting" : "connecting";
    this.patchHealth({ status, attempt, error: null, retryAfterMs: null });
  }

  onOpen(): void {
    this.patchHealth({ status: "connecting", attempt: 0, error: null, retryAfterMs: null });
  }

  onClosed(info: { reason: string; status: number | null; retryInMs: number | null }): void {
    if (info.reason === "aborted" || info.reason === "tokens_changed") return;
    this.patchHealth({
      status: info.retryInMs === null ? "disconnected" : "reconnecting",
      error: info.reason,
      retryAfterMs: info.retryInMs,
      connectionId: null,
    });
  }

  onFrame(frame: SseFrame): void {
    const at = this.deps.now();
    const data = decodeFrameData(frame);
    if (data === null) {
      // Malformed payloads are counted as traffic but never reach the cache.
      this.patchHealth({ lastFrameAt: at });
      return;
    }
    switch (frame.event) {
      case "hello":
        this.onHello(data, at);
        break;
      case "tick":
        this.onTick(data, frame.id, at);
        break;
      case "heartbeat":
        this.onHeartbeat(data, at);
        break;
      case "session":
        this.onSessionFrame(data, at);
        break;
      case "resync":
        this.onResync(data, at);
        break;
      default:
        this.patchHealth({ lastFrameAt: at });
        break;
    }
  }

  private onHello(data: Record<string, unknown>, at: number): void {
    const session = isRecord(data.session) ? decodeSession(data.session) : null;
    const rejected = Array.isArray(data.rejected) ? data.rejected.length : 0;
    this.patchHealth({
      status: "live",
      connectionId: asNonEmptyString(data.connection_id),
      heartbeatMs: asFiniteNumber(data.heartbeat_ms),
      maxInstruments: asFiniteNumber(data.max_instruments),
      schemaVersion: asNonEmptyString(data.schema_version),
      rejectedTokens: rejected,
      lastFrameAt: at,
      attempt: 0,
      error: null,
      retryAfterMs: null,
    });
    if (session !== null) this.applySession(session);
    // A new connection is a continuity break: the global `seq` may have been
    // reset by a server restart, so guards are cleared and state re-read.
    this.cache.resetSequenceGuards();
    void this.hydrateTokens(this.cache.subscribedTokens());
  }

  private onTick(data: Record<string, unknown>, id: string | null, at: number): void {
    const token = asToken(data.t);
    if (token === null) {
      this.patchHealth({ lastFrameAt: at });
      return;
    }
    this.cache.applyTick(data, at);
    this.patchHealth({
      status: "live",
      lastFrameAt: at,
      lastTickAt: at,
      lastEventId: id ?? this.health.lastEventId,
    });
    this.scheduleFlush();
  }

  private onHeartbeat(data: Record<string, unknown>, at: number): void {
    this.patchHealth({
      status: "live",
      lastFrameAt: at,
      lastHeartbeatAt: at,
      lagMs: asFiniteNumber(data.lag_ms),
    });
  }

  private onSessionFrame(data: Record<string, unknown>, at: number): void {
    this.patchHealth({ lastFrameAt: at });
    const session = decodeSession(data);
    if (session !== null) this.applySession(session);
  }

  private onResync(data: Record<string, unknown>, at: number): void {
    const reason = asResyncReason(data.reason);
    this.patchHealth({
      lastFrameAt: at,
      resync: {
        reason,
        rawReason: typeof data.reason === "string" ? data.reason : "unknown",
        fromSeq: asFiniteNumber(data.from_seq),
        at,
      },
    });
    this.cache.resetSequenceGuards();
    void this.hydrateTokens(this.cache.subscribedTokens());
  }

  /**
   * Stream frames carry the calendar clock and often omit `data_status`.
   * REST `data_state` is the payload freshness. A later hello/session with a
   * null data_status must not wipe a REST last-session/current flag.
   */
  private applySession(incoming: SessionState): void {
    const current = this.cache.getSession();
    const session: SessionState = {
      marketState: incoming.marketState,
      sessionDate: incoming.sessionDate ?? current?.sessionDate ?? null,
      coverage: incoming.coverage,
      dataStatus: incoming.dataStatus ?? current?.dataStatus ?? null,
      liveDataExpected: incoming.liveDataExpected ?? current?.liveDataExpected ?? null,
      asOf: incoming.asOf ?? current?.asOf ?? null,
    };
    const changed = this.cache.setSession(session);
    if (!changed) return;
    this.broadcast({ type: "session", session });
    this.scheduleFlush();
    for (const record of this.aux.values()) {
      if (record.refs > 0) this.scheduleAuxRefresh(record, 0);
    }
  }

  /** Copy backend `data_state` onto the session. Does not invent a status. */
  private applyRestState(result: RestResult<unknown>): void {
    if (result.dataStatus == null && result.asOf == null && result.marketState == null) return;
    const current = this.cache.getSession();
    this.applySession({
      marketState: current?.marketState ?? result.marketState ?? "unknown",
      sessionDate: current?.sessionDate ?? null,
      coverage: current?.coverage ?? null,
      dataStatus: result.dataStatus ?? current?.dataStatus ?? null,
      liveDataExpected: current?.liveDataExpected ?? null,
      asOf: result.asOf ?? current?.asOf ?? null,
    });
  }

  /* ---------------- aux (REST-backed panels) ---------------- */

  private requestAux(record: PortRecord, kind: AuxKind, key: string): void {
    const id = auxId(kind, key);
    record.aux.set(id, (record.aux.get(id) ?? 0) + 1);
    const existing = this.aux.get(id);
    if (existing) {
      existing.refs += 1;
      this.send(record.port, { type: "aux", entry: existing.entry });
      return;
    }
    const created: AuxRecord = {
      entry: idleAux(kind, key),
      refs: 1,
      timer: null,
      inflight: false,
    };
    this.aux.set(id, created);
    this.scheduleAuxRefresh(created, 0);
  }

  private releaseAuxFor(record: PortRecord, kind: AuxKind, key: string): void {
    const id = auxId(kind, key);
    const held = record.aux.get(id) ?? 0;
    if (held <= 0) return;
    if (held === 1) record.aux.delete(id);
    else record.aux.set(id, held - 1);
    this.releaseAux(id);
  }

  private releaseAux(id: string): void {
    const record = this.aux.get(id);
    if (!record) return;
    record.refs -= 1;
    if (record.refs > 0) return;
    if (record.timer !== null) this.deps.clearTimer(record.timer);
    this.aux.delete(id);
  }

  private scheduleAuxRefresh(record: AuxRecord, delayMs: number): void {
    if (record.timer !== null) {
      this.deps.clearTimer(record.timer);
      record.timer = null;
    }
    record.timer = this.deps.setTimer(() => {
      record.timer = null;
      void this.loadAux(record);
    }, delayMs);
  }

  private async loadAux(record: AuxRecord): Promise<void> {
    if (record.inflight || record.refs <= 0) return;
    record.inflight = true;
    const base = record.entry;
    this.publishAux(record, { ...base, status: "loading" });
    try {
      const next = await this.fetchAux(base);
      this.publishAux(record, next);
    } finally {
      record.inflight = false;
    }
    // Re-poll only while the cash session is open; a closed market has no new data.
    if (record.refs > 0 && this.cache.getSession()?.marketState === "open") {
      this.scheduleAuxRefresh(record, AUX_REFRESH_MS);
    }
  }

  private async fetchAux(base: AuxEntry): Promise<AuxEntry> {
    const { key } = base;
    switch (base.kind) {
      case "options": {
        const [underlying, expiry] = splitKey(key);
        const result = await this.deps.rest.fetchOptionChain(underlying, expiry);
        return { ...base, ...this.auxMeta(base, result), data: result.data };
      }
      case "futures": {
        const result = await this.deps.rest.fetchFuturesBook(key);
        return { ...base, ...this.auxMeta(base, result), data: result.data };
      }
      case "activity": {
        const result = await this.deps.rest.fetchUnusualActivity(ACTIVITY_LIMIT);
        return { ...base, ...this.auxMeta(base, result), data: result.data };
      }
      case "candles": {
        const [symbol, interval] = splitKey(key);
        const result = await this.deps.rest.fetchCandles(symbol, interval ?? "5m");
        return { ...base, ...this.auxMeta(base, result), data: result.data };
      }
    }
  }

  private auxMeta(base: AuxEntry, result: RestResult<unknown>): AuxMeta {
    return {
      key: base.key,
      status: result.status,
      dataStatus: result.dataStatus,
      marketState: result.marketState,
      asOf: result.asOf,
      reason: result.reason,
      updatedAt: this.deps.now(),
    };
  }

  private publishAux(record: AuxRecord, entry: AuxEntry): void {
    record.entry = entry;
    this.broadcast({ type: "aux", entry });
  }

  /* ---------------- health, flush, watchdog ---------------- */

  private patchHealth(patch: Partial<StreamHealth>): void {
    const next = { ...this.health, ...patch };
    if (shallowEqualHealth(next, this.health)) return;
    this.health = next;
    this.broadcast({ type: "health", health: next });
  }

  getHealth(): StreamHealth {
    return this.health;
  }

  getCache(): MarketCache {
    return this.cache;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = this.deps.setTimer(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  flush(): void {
    const updates = this.cache.drainDirty();
    if (updates.length === 0) return;
    this.broadcast({ type: "instruments", updates });
  }

  private ensureWatchdog(): void {
    if (this.watchdogTimer !== null) return;
    const run = () => {
      this.watchdogTimer = this.deps.setTimer(run, WATCHDOG_INTERVAL_MS);
      this.runWatchdog();
    };
    this.watchdogTimer = this.deps.setTimer(run, WATCHDOG_INTERVAL_MS);
  }

  /**
   * Marks the transport stale once frames stop arriving for longer than the
   * server-advertised heartbeat budget. The multiplier is the only local
   * constant, and it is applied to `hello.heartbeat_ms`, never to a guess.
   */
  runWatchdog(): void {
    const now = this.deps.now();
    for (const [id, record] of this.ports) {
      if (now - record.lastSeenAt > PORT_TIMEOUT_MS) this.detach(id);
    }
    if (this.health.status !== "live") return;
    const budget = (this.health.heartbeatMs ?? 5_000) * STALE_HEARTBEAT_MULTIPLIER;
    const last = this.health.lastFrameAt;
    if (last !== null && now - last > budget) {
      this.patchHealth({ status: "stale" });
    }
  }

  /* ---------------- outbound ---------------- */

  private sendSnapshot(port: PortLike): void {
    this.send(port, {
      type: "snapshot",
      instruments: this.cache.all(),
      health: this.health,
      session: this.cache.getSession(),
      tokensBySymbol: this.cache.tokensBySymbol(),
      aux: [...this.aux.values()].map((record) => record.entry),
    });
  }

  private broadcast(message: WorkerMessage): void {
    for (const record of this.ports.values()) this.send(record.port, message);
  }

  private send(port: PortLike, message: WorkerMessage): void {
    try {
      port.postMessage(message);
    } catch {
      // A dead port must not take down the hub; the watchdog reaps it.
    }
  }
}

function normalizeTokens(tokens: unknown[]): number[] {
  const out: number[] = [];
  for (const raw of tokens) {
    const token = asToken(raw);
    if (token !== null) out.push(token);
  }
  return out;
}

function splitKey(key: string): [string, string | null] {
  const index = key.indexOf("|");
  if (index === -1) return [key, null];
  return [key.slice(0, index), key.slice(index + 1) || null];
}

function idleAux(kind: AuxKind, key: string): AuxEntry {
  const meta: AuxMeta = {
    key,
    status: "idle",
    dataStatus: null,
    marketState: null,
    asOf: null,
    reason: null,
    updatedAt: null,
  };
  switch (kind) {
    case "options":
      return { ...meta, kind, data: null };
    case "futures":
      return { ...meta, kind, data: null };
    case "activity":
      return { ...meta, kind, data: null };
    case "candles":
      return { ...meta, kind, data: null };
  }
}

const HEALTH_KEYS: ReadonlyArray<keyof StreamHealth> = [
  "status",
  "connectionId",
  "lastEventId",
  "lastFrameAt",
  "lastHeartbeatAt",
  "lastTickAt",
  "heartbeatMs",
  "lagMs",
  "subscribedTokens",
  "maxInstruments",
  "schemaVersion",
  "rejectedTokens",
  "resync",
  "attempt",
  "error",
  "retryAfterMs",
];

function shallowEqualHealth(a: StreamHealth, b: StreamHealth): boolean {
  return HEALTH_KEYS.every((key) => {
    if (key === "resync") return a.resync?.at === b.resync?.at;
    return a[key] === b[key];
  });
}
