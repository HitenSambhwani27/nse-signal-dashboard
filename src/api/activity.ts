import { apiGet, encodePathSegment } from "@/api/client";
import type { MarketActivityResponse, UnusualActivityResponse } from "@/api/types";

export function marketActivityPath(symbol: string): string {
  return `/api/v1/market-activity/${encodePathSegment(symbol)}`;
}

export function unusualActivityPath(limit = 50): string {
  return `/api/v1/unusual-activity?limit=${encodeURIComponent(String(limit))}`;
}

export function fetchMarketActivity(
  symbol: string,
  signal?: AbortSignal,
): Promise<MarketActivityResponse> {
  return apiGet<MarketActivityResponse>(marketActivityPath(symbol), { signal });
}

export function fetchUnusualActivity(
  limit = 50,
  signal?: AbortSignal,
): Promise<UnusualActivityResponse> {
  return apiGet<UnusualActivityResponse>(unusualActivityPath(limit), { signal });
}
