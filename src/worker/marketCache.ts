/**
 * Normalized market state owned by the SharedWorker.
 *
 * Raw Phase 5 wire shapes stop here: everything downstream reads
 * `InstrumentState`. Only the latest state per instrument is retained — no raw
 * tick history, no unbounded growth (§7, §33).
 */

import {
  asFiniteNumber,
  asMarketState,
  asNonEmptyString,
  asToken,
  emptyInstrumentState,
  isRecord,
  type InstrumentMeta,
  type InstrumentState,
  type SessionState,
} from "./protocol";

/**
 * Phase 5 abbreviations (`frames._ABBREV`) that the terminal consumes.
 * `bb`/`ba` are the best bid/ask *prices*; `bid`/`ask` are the depth ladders,
 * which the terminal does not display and deliberately does not store.
 */
type NumericField = "ltp" | "change" | "changePct" | "volume" | "oi" | "bid" | "ask";

const TICK_FIELDS: ReadonlyArray<readonly [string, NumericField]> = [
  ["ltp", "ltp"],
  ["chg", "change"],
  ["chgp", "changePct"],
  ["vol", "volume"],
  ["oi", "oi"],
  ["bb", "bid"],
  ["ba", "ask"],
];

export interface QuoteSnapshot {
  token: number;
  meta: InstrumentMeta;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  oi: number | null;
  bid: number | null;
  ask: number | null;
  timestamp: string | null;
}

export interface ApplyResult {
  changed: boolean;
  dropped: "duplicate" | "out_of_order" | "unknown_token" | "malformed" | null;
}

export class MarketCache {
  private readonly states = new Map<number, InstrumentState>();
  private readonly refs = new Map<number, number>();
  private readonly dirty = new Set<number>();
  private readonly symbolToToken = new Map<string, number>();
  private session: SessionState | null = null;

  /* ---------------- subscriptions ---------------- */

  /** Ref-counted so Marketwatch and Core sharing HDFCBANK is one upstream token. */
  retain(tokens: number[]): void {
    for (const token of tokens) {
      this.refs.set(token, (this.refs.get(token) ?? 0) + 1);
      if (!this.states.has(token)) this.states.set(token, emptyInstrumentState(token));
    }
  }

  release(tokens: number[]): void {
    for (const token of tokens) {
      const next = (this.refs.get(token) ?? 0) - 1;
      if (next > 0) {
        this.refs.set(token, next);
        continue;
      }
      this.refs.delete(token);
      this.states.delete(token);
      this.dirty.delete(token);
    }
  }

  subscribedTokens(): number[] {
    return [...this.refs.keys()].sort((a, b) => a - b);
  }

  refCount(token: number): number {
    return this.refs.get(token) ?? 0;
  }

  /* ---------------- identity ---------------- */

  mapSymbol(symbol: string, token: number): void {
    this.symbolToToken.set(symbol, token);
  }

  tokenForSymbol(symbol: string): number | null {
    return this.symbolToToken.get(symbol) ?? null;
  }

  tokensBySymbol(): Record<string, number> {
    return Object.fromEntries(this.symbolToToken);
  }

  /* ---------------- reads ---------------- */

  get(token: number): InstrumentState | undefined {
    return this.states.get(token);
  }

  all(): InstrumentState[] {
    return [...this.states.values()];
  }

  getSession(): SessionState | null {
    return this.session;
  }

  drainDirty(): InstrumentState[] {
    if (this.dirty.size === 0) return [];
    const out: InstrumentState[] = [];
    for (const token of this.dirty) {
      const state = this.states.get(token);
      if (state) out.push(state);
    }
    this.dirty.clear();
    return out;
  }

  /* ---------------- writes ---------------- */

  /** REST-sourced initial values. Never overwrites a fresher stream value. */
  hydrate(snapshot: QuoteSnapshot, at: number): boolean {
    const existing = this.states.get(snapshot.token) ?? emptyInstrumentState(snapshot.token);
    if (existing.origin === "stream" && existing.receivedAt !== null) {
      // A stream tick already owns this instrument; only fill in static metadata.
      const merged: InstrumentState = { ...existing, meta: mergeMeta(existing.meta, snapshot.meta) };
      if (metaEqual(merged.meta, existing.meta)) return false;
      this.states.set(snapshot.token, merged);
      this.dirty.add(snapshot.token);
      return true;
    }
    const next: InstrumentState = {
      ...existing,
      meta: mergeMeta(existing.meta, snapshot.meta),
      ltp: snapshot.ltp,
      change: snapshot.change,
      changePct: snapshot.changePct,
      volume: snapshot.volume,
      oi: snapshot.oi,
      bid: snapshot.bid,
      ask: snapshot.ask,
      timestamp: snapshot.timestamp,
      receivedAt: at,
      origin: "snapshot",
    };
    this.states.set(snapshot.token, next);
    this.dirty.add(snapshot.token);
    return true;
  }

  /**
   * Apply one Phase 5 `tick` payload.
   *
   * The stream sends field-level deltas, so absent fields keep their previous
   * value. `seq` is a single global counter, which still increases per token,
   * so a per-token guard rejects duplicates and out-of-order frames (E.8).
   */
  applyTick(payload: unknown, at: number): ApplyResult {
    if (!isRecord(payload)) return { changed: false, dropped: "malformed" };
    const token = asToken(payload.t);
    if (token === null) return { changed: false, dropped: "malformed" };

    const existing = this.states.get(token);
    if (!existing) return { changed: false, dropped: "unknown_token" };

    const seq = asFiniteNumber(payload.seq);
    if (seq !== null && existing.seq !== null) {
      if (seq === existing.seq) return { changed: false, dropped: "duplicate" };
      if (seq < existing.seq) return { changed: false, dropped: "out_of_order" };
    }

    const next: InstrumentState = { ...existing };
    let touched = false;
    for (const [wire, field] of TICK_FIELDS) {
      if (!(wire in payload)) continue;
      const value = payload[wire];
      const parsed = value === null ? null : asFiniteNumber(value);
      if (value !== null && parsed === null) continue; // malformed field, keep prior
      if (next[field] !== parsed) touched = true;
      next[field] = parsed;
    }

    const ts = asNonEmptyString(payload.ts);
    if (ts !== null && ts !== next.timestamp) {
      next.timestamp = ts;
      touched = true;
    }
    if (seq !== null) next.seq = seq;
    next.receivedAt = at;
    next.origin = "stream";

    this.states.set(token, next);
    if (!touched) return { changed: false, dropped: null };
    this.dirty.add(token);
    return { changed: true, dropped: null };
  }

  /**
   * A new connection or a resync invalidates sequence continuity. Phase 5 never
   * backfills, so the guard is reset and callers re-hydrate from REST rather
   * than pretending the gap did not happen (§23, §24).
   */
  resetSequenceGuards(): number[] {
    const tokens: number[] = [];
    for (const [token, state] of this.states) {
      if (state.seq === null) continue;
      this.states.set(token, { ...state, seq: null });
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Session rollover clears session-cumulative fields; carrying yesterday's
   * volume or OI into a new session date would be a fabricated continuity.
   */
  setSession(session: SessionState): boolean {
    const previous = this.session;
    this.session = session;
    if (previous === null) return true;
    if (previous.sessionDate === session.sessionDate) {
      return (
        previous.marketState !== session.marketState ||
        previous.coverage !== session.coverage ||
        previous.dataStatus !== session.dataStatus
      );
    }
    for (const [token, state] of this.states) {
      this.states.set(token, {
        ...state,
        change: null,
        changePct: null,
        volume: null,
        oi: null,
        seq: null,
      });
      this.dirty.add(token);
    }
    return true;
  }
}

function mergeMeta(existing: InstrumentMeta, incoming: InstrumentMeta): InstrumentMeta {
  return {
    symbol: incoming.symbol ?? existing.symbol,
    exchange: incoming.exchange ?? existing.exchange,
    instrumentType: incoming.instrumentType ?? existing.instrumentType,
    lotSize: incoming.lotSize ?? existing.lotSize,
    tickSize: incoming.tickSize ?? existing.tickSize,
  };
}

function metaEqual(a: InstrumentMeta, b: InstrumentMeta): boolean {
  return (
    a.symbol === b.symbol &&
    a.exchange === b.exchange &&
    a.instrumentType === b.instrumentType &&
    a.lotSize === b.lotSize &&
    a.tickSize === b.tickSize
  );
}

/* ---------------- Phase 5 payload decoders ---------------- */

export function decodeSession(payload: unknown): SessionState | null {
  if (!isRecord(payload)) return null;
  const coverage = payload.coverage === "PARTIAL_SESSION" ? "PARTIAL_SESSION" : null;
  const liveExpected = payload.live_data_expected;
  return {
    marketState: asMarketState(payload.market_state),
    sessionDate: asNonEmptyString(payload.session_date),
    coverage,
    dataStatus: asNonEmptyString(payload.data_status),
    liveDataExpected: typeof liveExpected === "boolean" ? liveExpected : null,
    asOf: asNonEmptyString(payload.as_of),
  };
}
