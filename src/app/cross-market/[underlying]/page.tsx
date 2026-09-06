"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { crossMarketPath } from "@/api/crossMarket";
import type { CrossMarketResponse } from "@/api/types";
import { ChainStatusBadge, DataFreshnessBadge } from "@/components/data/Badges";
import { MetricCard } from "@/components/data/MetricCard";
import { ErrorState, LoadingState, EmptyState } from "@/components/data/States";
import { FuturesPanel } from "@/components/futures/FuturesPanel";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatInr, formatPcr } from "@/lib/format";
import { INDEX_INSTRUMENTS, decodeParam, underlyingForSymbol } from "@/lib/instruments";

export default function CrossMarketPage() {
  const params = useParams();
  const underlying = underlyingForSymbol(decodeParam(params.underlying as string) || "NIFTY");
  const q = useApiQuery<CrossMarketResponse>(crossMarketPath(underlying), 8000);
  const payload = q.data?.cross_market;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{underlying} cross-market</h1>
          <p className="page-sub">
            GET /api/v1/cross-market/{underlying}. Relationships are descriptive, not probabilities.
          </p>
        </div>
        <div className="row">
          {INDEX_INSTRUMENTS.map((i) => (
            <Link
              key={i.underlying}
              className={`btn ${i.underlying === underlying ? "active" : ""}`}
              href={`/cross-market/${i.underlying}`}
            >
              {i.label}
            </Link>
          ))}
          <DataFreshnessBadge asOf={q.data?.as_of} />
        </div>
      </div>
      {q.status === "error" && !q.data ? <ErrorState detail={q.error} /> : null}
      {q.status === "loading" && !payload ? <LoadingState /> : null}
      {payload ? (
        <>
          <div className="panel">
            <div className="panel-h">Inferred relationships</div>
            <div className="panel-b">
              {(payload.relationships ?? []).length ? (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {payload.relationships!.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No descriptive relationships" detail={payload.note ?? undefined} />
              )}
              <p className="page-sub">{payload.note}</p>
            </div>
          </div>
          <div className="grid-4">
            <MetricCard label="Spot" value={formatInr(payload.futures?.spot)} />
            <MetricCard label="Near futures" value={formatInr(payload.futures?.contracts?.[0]?.ltp)} />
            <MetricCard label="Basis" value={payload.futures?.contracts?.[0]?.basis == null ? "—" : formatInr(payload.futures.contracts[0].basis)} />
            <MetricCard label="PCR" value={formatPcr(payload.options_summary?.pcr_oi)} />
            <MetricCard label="ATM" value={payload.options_summary?.atm == null ? "—" : String(payload.options_summary.atm)} />
            <div className="metric">
              <div className="k">Chain status</div>
              <div className="v">
                <ChainStatusBadge
                  status={payload.options_summary?.chain_status}
                  quoteStatus={payload.options_summary?.quote_status}
                />
              </div>
            </div>
          </div>
          <FuturesPanel book={payload.futures} />
        </>
      ) : q.status === "ok" ? (
        <EmptyState title="Cross-market unavailable" />
      ) : null}
    </div>
  );
}
