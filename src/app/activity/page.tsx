"use client";

import { useMemo, useState } from "react";
import { marketActivityPath } from "@/api/activity";
import { watchlistsPath } from "@/api/watchlists";
import type { MarketActivityResponse, WatchlistsResponse } from "@/api/types";
import { ActivityPanel } from "@/components/activity/ActivityPanel";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { ErrorState, LoadingState } from "@/components/data/States";
import { DepthChart } from "@/components/charts/DepthChart";
import { useApiQuery } from "@/hooks/useApiQuery";
import { INDEX_INSTRUMENTS } from "@/lib/instruments";

export default function ActivityPage() {
  const lists = useApiQuery<WatchlistsResponse>(watchlistsPath(), 30_000);
  const symbols = useMemo(() => {
    const set = new Set<string>(INDEX_INSTRUMENTS.map((i) => i.spotSymbol));
    for (const list of lists.data?.watchlists ?? []) {
      for (const s of list.symbols ?? []) set.add(s);
    }
    return [...set];
  }, [lists.data]);
  const [symbol, setSymbol] = useState("NIFTY 50");
  const q = useApiQuery<MarketActivityResponse>(marketActivityPath(symbol), 5000);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Market activity</h1>
          <p className="page-sub">
            Observed last-trade size and inferred book pressure. Not confirmed institutional or HFT flow.
          </p>
        </div>
        <DataFreshnessBadge asOf={q.data?.as_of} />
      </div>
      <div className="row">
        <select className="btn" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="btn"
          style={{ width: 160 }}
          placeholder="Or type symbol"
          onKeyDown={(e) => {
            if (e.key === "Enter") setSymbol((e.target as HTMLInputElement).value.trim().toUpperCase());
          }}
        />
      </div>
      {q.status === "error" && !q.data ? <ErrorState detail={q.error} /> : null}
      {q.status === "loading" && !q.data ? <LoadingState /> : <ActivityPanel payload={q.data} />}
      <DepthChart quote={q.data?.quote ?? null} />
    </div>
  );
}
