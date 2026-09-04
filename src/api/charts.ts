import { apiGet, encodePathSegment } from "@/api/client";
import type { ChartsResponse } from "@/api/types";

export function chartsPath(symbol: string): string {
  return `/api/v1/charts/${encodePathSegment(symbol)}`;
}

export function fetchCharts(symbol: string, signal?: AbortSignal): Promise<ChartsResponse> {
  return apiGet<ChartsResponse>(chartsPath(symbol), { signal });
}
