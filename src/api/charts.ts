import { apiGet, encodePathSegment } from "@/api/client";
import type { ChartsResponse } from "@/api/types";

export function chartsPath(symbol: string, interval?: string): string {
  const base = `/api/v1/charts/${encodePathSegment(symbol)}`;
  if (!interval) return base;
  return `${base}?interval=${encodeURIComponent(interval)}`;
}

export function fetchCharts(
  symbol: string,
  signal?: AbortSignal,
  interval?: string,
): Promise<ChartsResponse> {
  return apiGet<ChartsResponse>(chartsPath(symbol, interval), { signal });
}
