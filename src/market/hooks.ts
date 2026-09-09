"use client";

/**
 * The browser-facing live-market API.
 *
 * Every hook is backed by `useSyncExternalStore` against the per-token
 * subscriber registry in `marketBridge`, so an update to one instrument
 * re-renders only the components reading that instrument.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { marketBridge } from "@/market/bridge";
import {
  initialStreamHealth,
  type AuxEntry,
  type AuxKind,
  type InstrumentState,
  type SessionState,
  type StreamHealth,
} from "@/worker/protocol";

export type OptionsAux = Extract<AuxEntry, { kind: "options" }>;
export type FuturesAux = Extract<AuxEntry, { kind: "futures" }>;
export type ActivityAux = Extract<AuxEntry, { kind: "activity" }>;
export type CandlesAux = Extract<AuxEntry, { kind: "candles" }>;

const IDLE_HEALTH = initialStreamHealth();
const NO_SESSION: SessionState | null = null;
const NO_INSTRUMENT: InstrumentState | null = null;
const NO_AUX: AuxEntry | null = null;
const NO_TOKENS: Record<string, number> = {};

export function useStreamHealth(): StreamHealth {
  return useSyncExternalStore(
    useCallback((listener: () => void) => marketBridge.subscribeHealth(listener), []),
    () => marketBridge.getHealth(),
    () => IDLE_HEALTH,
  );
}

export function useMarketSession(): SessionState | null {
  return useSyncExternalStore(
    useCallback((listener: () => void) => marketBridge.subscribeSession(listener), []),
    () => marketBridge.getSession(),
    () => NO_SESSION,
  );
}

/** Subscribes to the instrument for as long as the component is mounted. */
export function useInstrumentQuote(token: number | null): InstrumentState | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (token === null) return () => undefined;
      return marketBridge.subscribeInstrument(token, listener);
    },
    [token],
  );
  return useSyncExternalStore(
    subscribe,
    () => (token === null ? NO_INSTRUMENT : marketBridge.getInstrument(token) ?? NO_INSTRUMENT),
    () => NO_INSTRUMENT,
  );
}

/**
 * Resolves symbols to instrument tokens through the worker. There is no
 * `/instruments` route, so identity comes from the REST quote DTO.
 */
export function useSymbolTokens(symbols: readonly string[]): Record<string, number> {
  const key = symbols.join("\u0000");
  useEffect(() => {
    if (key === "") return;
    marketBridge.resolveSymbols(key.split("\u0000"));
  }, [key]);
  return useSyncExternalStore(
    useCallback((listener: () => void) => marketBridge.subscribeSymbols(listener), []),
    () => marketBridge.getSymbolTokens(),
    () => NO_TOKENS,
  );
}

function useAuxEntry(kind: AuxKind, key: string | null): AuxEntry | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (key === null) return () => undefined;
      return marketBridge.subscribeAux(kind, key, listener);
    },
    [kind, key],
  );
  return useSyncExternalStore(
    subscribe,
    () => (key === null ? NO_AUX : marketBridge.getAux(kind, key) ?? NO_AUX),
    () => NO_AUX,
  );
}

export function useOptionsData(
  underlying: string | null,
  expiry: string | null,
): OptionsAux | null {
  const key = underlying === null ? null : `${underlying}|${expiry ?? ""}`;
  const entry = useAuxEntry("options", key);
  return entry !== null && entry.kind === "options" ? entry : null;
}

export function useFuturesData(underlying: string | null): FuturesAux | null {
  const entry = useAuxEntry("futures", underlying);
  return entry !== null && entry.kind === "futures" ? entry : null;
}

export function useActivityFeed(): ActivityAux | null {
  const entry = useAuxEntry("activity", "market");
  return entry !== null && entry.kind === "activity" ? entry : null;
}

export function useCandles(symbol: string | null, interval: string): CandlesAux | null {
  const key = symbol === null ? null : `${symbol}|${interval}`;
  const entry = useAuxEntry("candles", key);
  return entry !== null && entry.kind === "candles" ? entry : null;
}

/* ------------------------------------------------------------------ */
/* Derived presentation state                                           */
/* ------------------------------------------------------------------ */

export type LiveStatusKind =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stale"
  | "disconnected"
  | "partial"
  | "idle";

export interface LiveStatus {
  kind: LiveStatusKind;
  label: string;
  /** Server-measured ingest lag from `heartbeat.lag_ms`. Never a fabricated latency. */
  lagMs: number | null;
  detail: string | null;
}

/**
 * Maps transport health onto the header badge. PARTIAL wins over LIVE because a
 * partial session is a continuity claim the user needs to see.
 */
export function useLiveStatus(): LiveStatus {
  const health = useStreamHealth();
  const session = useMarketSession();
  return useMemo(() => {
    const partial = session?.coverage === "PARTIAL_SESSION";
    switch (health.status) {
      case "live":
        return partial
          ? { kind: "partial", label: "PARTIAL", lagMs: health.lagMs, detail: "Partial session coverage" }
          : { kind: "live", label: "LIVE", lagMs: health.lagMs, detail: "SSE transport connected" };
      case "stale":
        return { kind: "stale", label: "STALE", lagMs: health.lagMs, detail: "No frames within heartbeat budget" };
      case "reconnecting":
        return { kind: "reconnecting", label: "RECONNECTING", lagMs: null, detail: health.error };
      case "connecting":
        return { kind: "connecting", label: "CONNECTING", lagMs: null, detail: null };
      case "disconnected":
        return { kind: "disconnected", label: "DISCONNECTED", lagMs: null, detail: health.error };
      case "idle":
      default:
        return { kind: "idle", label: "IDLE", lagMs: null, detail: null };
    }
  }, [health, session]);
}

/**
 * Per-instrument freshness. Uses the exchange timestamp the backend supplied —
 * no local clock is presented as a quote time.
 */
export function quoteIsLive(state: InstrumentState | null): boolean {
  return state !== null && state.origin === "stream" && state.ltp !== null;
}
