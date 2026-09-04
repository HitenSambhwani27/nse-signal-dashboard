import { apiGet } from "@/api/client";
import type { WatchlistQuotesResponse, WatchlistsResponse } from "@/api/types";

export function watchlistsPath(): string {
  return "/api/v1/watchlists";
}

export function watchlistQuotesPath(): string {
  return "/api/v1/watchlists/quotes";
}

export function fetchWatchlists(signal?: AbortSignal): Promise<WatchlistsResponse> {
  return apiGet<WatchlistsResponse>(watchlistsPath(), { signal });
}

export function fetchWatchlistQuotes(signal?: AbortSignal): Promise<WatchlistQuotesResponse> {
  return apiGet<WatchlistQuotesResponse>(watchlistQuotesPath(), { signal });
}
