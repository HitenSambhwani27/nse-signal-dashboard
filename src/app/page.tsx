"use client";

import Link from "next/link";
import { optionsPath } from "@/api/options";
import { futuresPath } from "@/api/futures";
import { unusualActivityPath } from "@/api/activity";
import { quotesPath } from "@/api/quotes";
import { watchlistQuotesPath } from "@/api/watchlists";
import type {
  FuturesResponse,
  OptionChainResponse,
  Quote,
  QuoteResponse,
  UnusualActivityResponse,
  WatchlistQuoteRow,
  WatchlistQuotesResponse,
} from "@/api/types";
import { IndexCard } from "@/components/data/IndexCard";
import { MetricCard } from "@/components/data/MetricCard";
import { AsOfLabel, ChainStatusBadge, DataFreshnessBadge } from "@/components/data/Badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/data/States";
import { UnusualActivityTable } from "@/components/activity/UnusualActivityTable";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import { useApiQuery } from "@/hooks/useApiQuery";
import {
  formatInr,
  formatOi,
  formatPcr,
  formatPct,
  formatTimestamp,
  formatVolume,
  signedTone,
} from "@/lib/format";
import { INDEX_INSTRUMENTS, symbolHref } from "@/lib/instruments";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

function quoteCols(): Column<WatchlistQuoteRow>[] {
  return [
    { key: "s", header: "Symbol", render: (r) => r.symbol },
    {
      key: "p",
      header: "LTP",
      align: "right",
      render: (r) => formatInr(r.quote?.last_price),
      sortValue: (r) => r.quote?.last_price ?? null,
    },
    {
      key: "c",
      header: "Chg %",
      align: "right",
      render: (r) => (
        <span className={`num ${signedTone(r.quote?.change_pct)}`}>{formatPct(r.quote?.change_pct)}</span>
      ),
      sortValue: (r) => r.quote?.change_pct ?? null,
    },
    {
      key: "v",
      header: "Volume",
      align: "right",
      render: (r) => formatVolume(r.quote?.volume),
      sortValue: (r) => r.quote?.volume ?? null,
    },
  ];
}

export default function OverviewPage() {
  const nifty = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[0].spotSymbol), 5000);
  const bank = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[1].spotSymbol), 5000);
  const watch = useApiQuery<WatchlistQuotesResponse>(watchlistQuotesPath(), 5000);
  const unusual = useApiQuery<UnusualActivityResponse>(unusualActivityPath(20), 10000);
  const futN = useApiQuery<FuturesResponse>(futuresPath("NIFTY"), 8000);
  const futB = useApiQuery<FuturesResponse>(futuresPath("BANKNIFTY"), 8000);
  const optN = useApiQuery<OptionChainResponse>(optionsPath("NIFTY"), 8000);
  const optB = useApiQuery<OptionChainResponse>(optionsPath("BANKNIFTY"), 8000);

  const movers = useMemo(() => {
    const quotes = watch.data?.quotes ?? [];
    const withPx = quotes.filter((q) => q.quote?.change_pct != null);
    const gainers = [...withPx].sort((a, b) => (b.quote!.change_pct! - a.quote!.change_pct!)).slice(0, 5);
    const losers = [...withPx].sort((a, b) => (a.quote!.change_pct! - b.quote!.change_pct!)).slice(0, 5);
    const active = [...quotes]
      .filter((q) => q.quote?.volume != null)
      .sort((a, b) => (b.quote!.volume! - a.quote!.volume!))
      .slice(0, 5);
    return { gainers, losers, active };
  }, [watch.data?.quotes]);

  const err = nifty.error || watch.error;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Market overview</h1>
          <div className="page-sub">
            Backend snapshots only. Empty panels are expected while the cash session is closed.
          </div>
        </div>
        <DataFreshnessBadge asOf={nifty.data?.as_of ?? watch.data?.as_of} />
      </div>

      {err && !nifty.data ? <ErrorState detail={err} /> : null}

      <div className="grid-2">
        <IndexCard label="NIFTY" quote={nifty.data?.quote ?? null} />
        <IndexCard label="BANKNIFTY" quote={bank.data?.quote ?? null} />
      </div>

      <div className="grid-2">
        <Snapshot quote={nifty.data?.quote ?? null} asOf={nifty.data?.as_of} name="NIFTY" loading={nifty.status === "loading"} />
        <Snapshot quote={bank.data?.quote ?? null} asOf={bank.data?.as_of} name="BANKNIFTY" loading={bank.status === "loading"} />
      </div>

      <div className="grid-3">
        <section className="panel">
          <div className="panel-h">
            <span>Top gainers</span>
            <Link href="/watchlists">Watchlists</Link>
          </div>
          <MoverTable rows={movers.gainers} loading={watch.status === "loading"} empty="No gainer snapshots" />
        </section>
        <section className="panel">
          <div className="panel-h">Top losers</div>
          <MoverTable rows={movers.losers} loading={watch.status === "loading"} empty="No loser snapshots" />
        </section>
        <section className="panel">
          <div className="panel-h">Most active</div>
          <MoverTable rows={movers.active} loading={watch.status === "loading"} empty="No volume snapshots" />
        </section>
      </div>

      <section className="panel">
        <div className="panel-h">
          <span>Unusual activity (inferred)</span>
          <Link href="/unusual">Open</Link>
        </div>
        <div className="panel-b">
          {unusual.status === "loading" && !unusual.data ? (
            <LoadingState />
          ) : (
            <UnusualActivityTable rows={unusual.data?.unusual_activity ?? []} />
          )}
        </div>
      </section>

      <div className="grid-2">
        <FuturesSnap title="NIFTY futures" res={futN} href="/futures/NIFTY" />
        <FuturesSnap title="BANKNIFTY futures" res={futB} href="/futures/BANKNIFTY" />
      </div>

      <div className="grid-2">
        <OptionsSnap title="NIFTY options" res={optN} href="/options/NIFTY" />
        <OptionsSnap title="BANKNIFTY options" res={optB} href="/options/BANKNIFTY" />
      </div>
    </div>
  );
}

function Snapshot({
  quote,
  asOf,
  name,
  loading,
}: {
  quote: Quote | null;
  asOf?: string | null;
  name: string;
  loading: boolean;
}) {
  if (loading && !quote) return <LoadingState label={`${name} snapshot`} />;
  if (!quote) {
    return (
      <div className="panel">
        <div className="panel-h">{name} snapshot</div>
        <EmptyState title="No live data" detail="Quote snapshot missing for this index." />
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-h">
        <span>{name} snapshot</span>
        <AsOfLabel value={asOf ?? quote.timestamp} />
      </div>
      <div className="panel-b grid-4">
        <MetricCard label="Price" value={formatInr(quote.last_price)} />
        <MetricCard label="Change" value={formatInr(quote.change)} tone={signedTone(quote.change)} />
        <MetricCard label="Change %" value={formatPct(quote.change_pct)} tone={signedTone(quote.change_pct)} />
        <MetricCard label="As of" value={formatTimestamp(quote.timestamp)} />
      </div>
    </div>
  );
}

function MoverTable({
  rows,
  loading,
  empty,
}: {
  rows: WatchlistQuoteRow[];
  loading: boolean;
  empty: string;
}) {
  const router = useRouter();
  if (loading && !rows.length) return <div className="panel-b"><LoadingState /></div>;
  return (
    <FinancialTable
      rows={rows}
      columns={quoteCols()}
      rowKey={(r) => r.symbol}
      onRowClick={(r) => router.push(symbolHref(r.symbol))}
      empty={empty}
      compact
    />
  );
}

function FuturesSnap({
  title,
  res,
  href,
}: {
  title: string;
  res: ReturnType<typeof useApiQuery<FuturesResponse>>;
  href: string;
}) {
  const near = res.data?.futures?.contracts?.[0];
  return (
    <section className="panel">
      <div className="panel-h">
        <span>{title}</span>
        <Link href={href}>Open</Link>
      </div>
      <div className="panel-b">
        {res.status === "loading" && !near ? (
          <LoadingState />
        ) : !near ? (
          <EmptyState title="No futures snapshot" />
        ) : (
          <div className="grid-4">
            <MetricCard label="Futures" value={formatInr(near.ltp)} />
            <MetricCard label="Spot" value={formatInr(near.spot)} />
            <MetricCard label="Basis" value={near.basis == null ? "—" : formatInr(near.basis)} />
            <MetricCard label="OI" value={formatOi(near.oi)} />
            <MetricCard label="Price/OI" value={near.price_oi?.label?.replaceAll("_", " ") ?? "—"} />
            <MetricCard label="Basis status" value={near.basis_status ?? "—"} />
          </div>
        )}
      </div>
    </section>
  );
}

function OptionsSnap({
  title,
  res,
  href,
}: {
  title: string;
  res: ReturnType<typeof useApiQuery<OptionChainResponse>>;
  href: string;
}) {
  const chain = res.data?.chain;
  return (
    <section className="panel">
      <div className="panel-h">
        <span>{title}</span>
        <Link href={href}>Open</Link>
      </div>
      <div className="panel-b">
        {res.status === "loading" && !chain ? (
          <LoadingState />
        ) : !chain ? (
          <EmptyState title="No options snapshot" />
        ) : (
          <div className="grid-4">
            <MetricCard label="PCR (OI)" value={formatPcr(chain.pcr_oi)} />
            <MetricCard label="ATM" value={chain.atm == null ? "—" : String(chain.atm)} />
            <MetricCard label="CE OI Δ peak" value={chain.largest_ce_oi_increase?.oi_change == null ? "—" : formatOi(chain.largest_ce_oi_increase.oi_change)} />
            <div className="metric">
              <div className="k">Chain</div>
              <div className="v">
                <ChainStatusBadge status={chain.chain_status} truncated={chain.truncated} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
