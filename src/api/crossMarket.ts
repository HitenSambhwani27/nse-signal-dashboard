import { apiGet, encodePathSegment } from "@/api/client";
import type { CrossMarketResponse } from "@/api/types";

export function crossMarketPath(underlying: string): string {
  return `/api/v1/cross-market/${encodePathSegment(underlying)}`;
}

export function fetchCrossMarket(
  underlying: string,
  signal?: AbortSignal,
): Promise<CrossMarketResponse> {
  return apiGet<CrossMarketResponse>(crossMarketPath(underlying), { signal });
}
