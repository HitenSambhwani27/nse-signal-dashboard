import type { ChartPoint, ChartSeries } from "@/api/types";
import { timeframeMs, type ChartTimeframe } from "@/lib/instruments";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export function hasOhlcFields(point: ChartPoint): boolean {
  return (
    point.open != null &&
    point.high != null &&
    point.low != null &&
    point.close != null &&
    !Number.isNaN(point.open) &&
    !Number.isNaN(point.high) &&
    !Number.isNaN(point.low) &&
    !Number.isNaN(point.close)
  );
}

/**
 * Extract candlesticks only when the backend supplies OHLC on each point.
 * Never synthesise candles from last_price observations.
 */
function candlesFromPoints(points: ChartPoint[] | null | undefined): Candle[] | null {
  if (!points || points.length === 0) return null;
  if (!points.every(hasOhlcFields)) return null;
  const candles: Candle[] = [];
  for (const point of points) {
    if (!point.timestamp || !hasOhlcFields(point)) continue;
    const time = Date.parse(point.timestamp);
    if (Number.isNaN(time)) continue;
    candles.push({
      time: Math.floor(time / 1000),
      open: point.open as number,
      high: point.high as number,
      low: point.low as number,
      close: point.close as number,
      volume: point.volume ?? null,
    });
  }
  return candles.length ? candles : null;
}

/**
 * Prefer a dedicated backend candles array. Fall back to points only when
 * every point already carries real OHLC. Never synthesise from last_price.
 */
export function extractCandles(series: ChartSeries | null | undefined): Candle[] | null {
  const dedicated = candlesFromPoints(series?.candles);
  if (dedicated) return dedicated;
  return candlesFromPoints(series?.points);
}

export function filterPointsByTimeframe(
  points: ChartPoint[] | null | undefined,
  timeframe: ChartTimeframe,
  now = Date.now(),
): ChartPoint[] {
  const list = points ?? [];
  const windowMs = timeframeMs(timeframe);
  if (windowMs == null) return list;
  const cutoff = now - windowMs;
  return list.filter((p) => {
    if (!p.timestamp) return false;
    const t = Date.parse(p.timestamp);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

/** Latest IST calendar date present in the series. Does not invent rows. */
export function latestSessionDate(points: ChartPoint[] | null | undefined): string | null {
  let latest: string | null = null;
  for (const point of points ?? []) {
    if (!point.timestamp) continue;
    const t = Date.parse(point.timestamp);
    if (Number.isNaN(t)) continue;
    const key = new Date(t + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!latest || key > latest) latest = key;
  }
  return latest;
}

export function pointsOnSessionDate(
  points: ChartPoint[] | null | undefined,
  sessionDate: string | null,
): ChartPoint[] {
  if (!sessionDate) return [];
  return (points ?? []).filter((p) => {
    if (!p.timestamp) return false;
    const t = Date.parse(p.timestamp);
    if (Number.isNaN(t)) return false;
    return new Date(t + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10) === sessionDate;
  });
}

export function resolveDisplayedPoints(
  points: ChartPoint[] | null | undefined,
  timeframe: ChartTimeframe,
  now = Date.now(),
): {
  points: ChartPoint[];
  mode: "selected" | "last_session" | "empty";
  sessionDate: string | null;
} {
  const selected = filterPointsByTimeframe(points, timeframe, now);
  if (selected.length) {
    return { points: selected, mode: "selected", sessionDate: latestSessionDate(selected) };
  }
  const sessionDate = latestSessionDate(points);
  const sessionPoints = pointsOnSessionDate(points, sessionDate);
  if (sessionPoints.length) {
    return { points: sessionPoints, mode: "last_session", sessionDate };
  }
  return { points: [], mode: "empty", sessionDate: null };
}

export function lastObservationIso(points: ChartPoint[] | null | undefined): string | null {
  let last: string | null = null;
  let lastMs = -Infinity;
  for (const point of points ?? []) {
    if (!point.timestamp) continue;
    const t = Date.parse(point.timestamp);
    if (Number.isNaN(t)) continue;
    if (t >= lastMs) {
      lastMs = t;
      last = point.timestamp;
    }
  }
  return last;
}

export const CANDLE_BACKEND_FIELDS = [
  "open",
  "high",
  "low",
  "close",
  "volume",
  "timestamp",
] as const;

export const CANDLE_BACKEND_NOTE =
  "Frontend dependency identified: backend must expose an OHLC candle series on GET /api/v1/charts/{symbol} (points[].open/high/low/close or a dedicated candles array keyed by interval) before candlesticks can render. Current chart points are downsampled last_price/volume/oi observations, not candles.";
