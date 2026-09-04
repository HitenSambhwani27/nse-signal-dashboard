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
export function extractCandles(series: ChartSeries | null | undefined): Candle[] | null {
  const points = series?.points;
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
