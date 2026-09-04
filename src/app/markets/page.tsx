"use client";

import { watchlistQuotesPath } from "@/api/watchlists";
import { quotesPath } from "@/api/quotes";
import type { QuoteResponse, WatchlistQuotesResponse } from "@/api/types";
import { IndexCard } from "@/components/data/IndexCard";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { WatchlistTable } from "@/components/watchlists/WatchlistTable";
import { useApiQuery } from "@/hooks/useApiQuery";
import { INDEX_INSTRUMENTS } from "@/lib/instruments";
import { ErrorState, LoadingState } from "@/components/data/States";

export default function MarketsPage() {
  const nifty = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[0].spotSymbol), 5000);
  const bank = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[1].spotSymbol), 5000);
  const watch = useApiQuery<WatchlistQuotesResponse>(watchlistQuotesPath(), 5000);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Markets</h1>
          <p className="page-sub">Index spots and the backend default watchlist book.</p>
        </div>
        <DataFreshnessBadge asOf={watch.data?.as_of} />
      </div>
      <div className="grid-2">
        <IndexCard label="NIFTY" quote={nifty.data?.quote ?? null} />
        <IndexCard label="BANKNIFTY" quote={bank.data?.quote ?? null} />
      </div>
      {watch.status === "error" && !watch.data ? (
        <ErrorState detail={watch.error} />
      ) : watch.status === "loading" && !watch.data ? (
        <LoadingState />
      ) : (
        <WatchlistTable lists={[{ id: 0, name: "quotes", created_at: null, symbols: (watch.data?.quotes ?? []).map((q) => q.symbol) }]} quotes={watch.data?.quotes ?? []} />
      )}
    </div>
  );
}
