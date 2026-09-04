"use client";

import { watchlistQuotesPath, watchlistsPath } from "@/api/watchlists";
import type { WatchlistQuotesResponse, WatchlistsResponse } from "@/api/types";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { ErrorState, LoadingState } from "@/components/data/States";
import { WatchlistTable } from "@/components/watchlists/WatchlistTable";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function WatchlistsPage() {
  const lists = useApiQuery<WatchlistsResponse>(watchlistsPath(), 15_000);
  const quotes = useApiQuery<WatchlistQuotesResponse>(watchlistQuotesPath(), 5000);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Watchlists</h1>
          <p className="page-sub">Read-only lists from GET /api/v1/watchlists. No create/update calls.</p>
        </div>
        <DataFreshnessBadge asOf={quotes.data?.as_of} />
      </div>
      {lists.status === "error" && !lists.data ? (
        <ErrorState detail={lists.error} />
      ) : lists.status === "loading" && !lists.data ? (
        <LoadingState />
      ) : (
        <WatchlistTable lists={lists.data?.watchlists ?? []} quotes={quotes.data?.quotes ?? []} />
      )}
    </div>
  );
}
