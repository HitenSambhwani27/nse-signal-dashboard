import { apiGet, encodePathSegment } from "@/api/client";
import type { QuoteResponse } from "@/api/types";

export function quotesPath(symbol: string): string {
  return `/api/v1/quotes/${encodePathSegment(symbol)}`;
}

export function fetchQuote(symbol: string, signal?: AbortSignal): Promise<QuoteResponse> {
  return apiGet<QuoteResponse>(quotesPath(symbol), { signal });
}
