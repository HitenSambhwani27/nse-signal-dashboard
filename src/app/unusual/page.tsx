"use client";

import { unusualActivityPath } from "@/api/activity";
import { watchlistQuotesPath } from "@/api/watchlists";
import type { UnusualActivityResponse, UnusualActivityRow, WatchlistQuotesResponse } from "@/api/types";
import { UnusualActivityTable } from "@/components/activity/UnusualActivityTable";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { ErrorState, LoadingState } from "@/components/data/States";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useMemo } from "react";

export default function UnusualPage() {
  const unusual = useApiQuery<UnusualActivityResponse>(unusualActivityPath(50), 8000);
  const quotes = useApiQuery<WatchlistQuotesResponse>(watchlistQuotesPath(), 8000);
  const rows = useMemo(() => {
    const map = new Map((quotes.data?.quotes ?? []).map((q) => [q.symbol, q.quote]));
    return (unusual.data?.unusual_activity ?? []).map((row): UnusualActivityRow => {
      const q = row.symbol ? map.get(row.symbol) : undefined;
      return {
        ...row,
        price: row.price ?? q?.last_price ?? null,
        change: row.change ?? q?.change_pct ?? null,
        volume: row.volume ?? q?.volume ?? null,
        last_quantity: row.last_quantity ?? q?.last_quantity ?? null,
        depth_imbalance: row.depth_imbalance ?? q?.depth_imbalance ?? null,
        timestamp: row.timestamp ?? q?.timestamp ?? unusual.data?.as_of ?? null,
      };
    });
  }, [unusual.data, quotes.data]);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Unusual activity</h1>
          <p className="page-sub">
            Ranked backend scores. Price/volume columns fill from watchlist quotes when the unusual payload omits them.
          </p>
        </div>
        <DataFreshnessBadge asOf={unusual.data?.as_of} />
      </div>
      {unusual.status === "error" && !unusual.data ? <ErrorState detail={unusual.error} /> : null}
      {unusual.status === "loading" && !unusual.data ? (
        <LoadingState />
      ) : (
        <UnusualActivityTable rows={rows} />
      )}
    </div>
  );
}
