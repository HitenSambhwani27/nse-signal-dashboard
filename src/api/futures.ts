import { apiGet, encodePathSegment } from "@/api/client";
import type { FuturesResponse } from "@/api/types";

export function futuresPath(underlying: string): string {
  return `/api/v1/futures/${encodePathSegment(underlying)}`;
}

export function fetchFutures(underlying: string, signal?: AbortSignal): Promise<FuturesResponse> {
  return apiGet<FuturesResponse>(futuresPath(underlying), { signal });
}
