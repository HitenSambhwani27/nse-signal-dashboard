"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { marketActivityPath, unusualActivityPath } from "@/api/activity";
import { chartsPath } from "@/api/charts";
import { futuresPath } from "@/api/futures";
import { optionsOiPath, optionsPath } from "@/api/options";
import { quotesPath } from "@/api/quotes";
import type {
  ChartsResponse,
  FuturesResponse,
  MarketActivityResponse,
  OptionChainResponse,
  OptionOiResponse,
  QuoteResponse,
  UnusualActivityResponse,
} from "@/api/types";
import { ActivityPanel } from "@/components/activity/ActivityPanel";
import { UnusualActivityTable } from "@/components/activity/UnusualActivityTable";
import { ActivityChart, OIChart, OIDeltaChart, VolumeChart, VolumeDeltaChart } from "@/components/charts/VolumeChart";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { DepthChart } from "@/components/charts/DepthChart";
import { PriceChart } from "@/components/charts/PriceChart";
import { StrikeOIChart } from "@/components/charts/StrikeOIChart";
import { ChainStatusBadge, DataFreshnessBadge, StatusBadge } from "@/components/data/Badges";
import { MetricCard } from "@/components/data/MetricCard";
import { PriceHeader } from "@/components/data/PriceHeader";
import { ErrorState, LoadingState } from "@/components/data/States";
import { FuturesPanel } from "@/components/futures/FuturesPanel";
import { OptionChainTable } from "@/components/options/OptionChain";
import { useApiQuery } from "@/hooks/useApiQuery";
import { extractCandles, pointsOnSessionDate, resolveDisplayedPoints } from "@/lib/candles";
import {
  formatInr,
  formatOi,
  formatPcr,
  formatQty,
  formatVolume,
  hasSessionOhlc,
} from "@/lib/format";
import {
  CHART_TIMEFRAMES,
  SYMBOL_TABS,
  decodeParam,
  symbolHref,
  type ChartTimeframe,
  type SymbolTab,
  underlyingForSymbol,
} from "@/lib/instruments";
import { useState } from "react";

export function SymbolTerminal({ tab }: { tab?: string }) {
  const params = useParams();
  const search = useSearchParams();
  const symbol = decodeParam(params.symbol as string) || "NIFTY 50";
  const active = (tab || (params.tab as string) || "overview") as SymbolTab;
  const expiry = search.get("expiry");
  const tf = (search.get("tf") as ChartTimeframe) || "1D";
  const quoteQ = useApiQuery<QuoteResponse>(quotesPath(symbol), 4000);
  const quote = quoteQ.data?.quote ?? null;
  const und = underlyingForSymbol(symbol);

  return (
    <div className="stack">
      <PriceHeader
        symbol={symbol}
        quote={quote}
        extra={
          <>
            <StatusBadge tone={quoteQ.data?.found ? "fresh" : "muted"}>
              {quoteQ.data?.found ? "Snapshot" : "No snapshot"}
            </StatusBadge>
            <Link className="btn" href="/watchlists">
              Watchlists
            </Link>
          </>
        }
      />
      {quoteQ.status === "error" && !quote ? <ErrorState detail={quoteQ.error} /> : null}
      <div className="tabs">
        {SYMBOL_TABS.map((item) => (
          <Link
            key={item.id}
            href={symbolHref(symbol, item.id === "overview" ? undefined : item.id)}
            className={active === item.id ? "active" : ""}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {active === "overview" ? <Overview symbol={symbol} /> : null}
      {active === "chart" ? <ChartTab symbol={symbol} tf={tf} /> : null}
      {active === "options" ? <OptionsTab underlying={und} expiry={expiry} /> : null}
      {active === "futures" ? <FuturesTab underlying={und} /> : null}
      {active === "activity" ? <ActivityTab symbol={symbol} /> : null}
      {active === "oi" ? <OiTab underlying={und} expiry={expiry} /> : null}
      {active === "unusual" ? <UnusualTab symbol={symbol} /> : null}
    </div>
  );
}

function Overview({ symbol }: { symbol: string }) {
  const q = useApiQuery<QuoteResponse>(quotesPath(symbol), 4000);
  const quote = q.data?.quote;
  if (q.status === "loading" && !quote) return <LoadingState />;
  if (!quote) return <ErrorState title="No snapshot" detail="GET /api/v1/quotes returned found=false." />;
  return (
    <div className="stack">
      <div className="grid-4">
        <MetricCard label="Price" value={formatInr(quote.last_price)} />
        <MetricCard label="Change" value={formatInr(quote.change)} />
        <MetricCard label="Volume" value={formatVolume(quote.volume)} />
        <MetricCard label="Last trade qty" value={formatQty(quote.last_quantity)} />
        <MetricCard label="Average price" value={formatInr(quote.average_price)} />
        <MetricCard
          label="OI"
          value={quote.missing_fields?.includes("oi") ? "—" : formatOi(quote.oi)}
        />
        <MetricCard label="Bid" value={formatInr(quote.best_bid)} />
        <MetricCard label="Ask" value={formatInr(quote.best_ask)} />
        <MetricCard label="Spread" value={formatInr(quote.spread)} />
        <MetricCard
          label="Depth imbalance"
          value={quote.depth_imbalance == null ? "—" : quote.depth_imbalance.toFixed(3)}
        />
        <MetricCard label="Buy qty (displayed)" value={formatQty(quote.buy_quantity)} />
        <MetricCard label="Sell qty (displayed)" value={formatQty(quote.sell_quantity)} />
      </div>
      <DepthChart quote={quote} />
      {hasSessionOhlc(quote.ohlc) && quote.ohlc ? (
        <div className="panel">
          <div className="panel-h">Session OHLC on snapshot (not a candle history)</div>
          <div className="panel-b grid-4">
            <MetricCard label="Open" value={formatInr(quote.ohlc.open)} />
            <MetricCard label="High" value={formatInr(quote.ohlc.high)} />
            <MetricCard label="Low" value={formatInr(quote.ohlc.low)} />
            <MetricCard label="Close" value={formatInr(quote.ohlc.close)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartTab({ symbol, tf }: { symbol: string; tf: ChartTimeframe }) {
  const [localTf, setLocalTf] = useState<ChartTimeframe>(tf);
  const q = useApiQuery<ChartsResponse>(chartsPath(symbol, localTf), 8000);
  const [series, setSeries] = useState<"price" | "volume" | "oi" | "oi_delta" | "volume_delta" | "candle">("price");
  const chart = q.data?.chart;
  const resolved = resolveDisplayedPoints(chart?.points ?? [], localTf);
  const points = resolved.points;
  const candles = extractCandles(
    chart
      ? {
          ...chart,
          candles:
            resolved.mode === "empty"
              ? []
              : pointsOnSessionDate(chart.candles ?? [], resolved.sessionDate),
        }
      : null,
  );
  if (q.status === "loading" && !q.data) return <LoadingState />;
  if (q.status === "error" && !q.data) return <ErrorState detail={q.error} />;
  return (
    <div className="stack">
      <div className="row">
        <div className="seg">
          {CHART_TIMEFRAMES.map((item) => (
            <button key={item} className={`btn ${localTf === item ? "active" : ""}`} onClick={() => setLocalTf(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="seg">
          {(["price", "volume", "oi", "oi_delta", "volume_delta", "candle"] as const).map((s) => (
            <button key={s} className={`btn ${series === s ? "active" : ""}`} onClick={() => setSeries(s)}>
              {s}
            </button>
          ))}
        </div>
        <DataFreshnessBadge asOf={q.data?.as_of} />
      </div>
      <ChartPanel
        title={`${symbol} ${series}`}
        extra={
          resolved.mode === "last_session" ? (
            <span className="page-sub">Last available session: {resolved.sessionDate}</span>
          ) : resolved.mode === "empty" ? (
            <span className="page-sub">No observations in the selected window</span>
          ) : null
        }
      >
        {series === "price" ? <PriceChart points={points} /> : null}
        {series === "volume" ? <VolumeChart points={points} /> : null}
        {series === "oi" ? <OIChart points={points} /> : null}
        {series === "oi_delta" ? <OIDeltaChart points={points} /> : null}
        {series === "volume_delta" ? <VolumeDeltaChart points={points} /> : null}
        {series === "candle" ? <CandlestickChart candles={candles} /> : null}
      </ChartPanel>
      <ActivityChart points={points} />
    </div>
  );
}

function OptionsTab({ underlying, expiry }: { underlying: string; expiry: string | null }) {
  const q = useApiQuery<OptionChainResponse>(optionsPath(underlying, expiry), 5000);
  const chain = q.data?.chain;
  if (q.status === "loading" && !chain) return <LoadingState />;
  if (!chain) return <ErrorState title="Option chain unavailable" detail={q.error} />;
  return (
    <div className="stack">
      <div className="row">
        <ChainStatusBadge
          status={chain.chain_status}
          truncated={chain.truncated}
          quoteStatus={chain.quote_status}
        />
        <MetricCard label="PCR" value={formatPcr(chain.pcr_oi)} />
        <MetricCard label="ATM" value={chain.atm == null ? "—" : String(chain.atm)} />
        <Link className="btn" href={`/options/${encodeURIComponent(underlying)}`}>
          Full terminal
        </Link>
      </div>
      <OptionChainTable chain={chain} />
    </div>
  );
}

function FuturesTab({ underlying }: { underlying: string }) {
  const q = useApiQuery<FuturesResponse>(futuresPath(underlying), 5000);
  if (q.status === "loading" && !q.data) return <LoadingState />;
  if (q.status === "error" && !q.data) return <ErrorState detail={q.error} />;
  return <FuturesPanel book={q.data?.futures ?? null} />;
}

function ActivityTab({ symbol }: { symbol: string }) {
  const q = useApiQuery<MarketActivityResponse>(marketActivityPath(symbol), 5000);
  if (q.status === "loading" && !q.data) return <LoadingState />;
  if (q.status === "error" && !q.data) return <ErrorState detail={q.error} />;
  return (
    <div className="stack">
      <ActivityPanel payload={q.data} />
      <DepthChart quote={q.data?.quote ?? null} />
    </div>
  );
}

function OiTab({ underlying, expiry }: { underlying: string; expiry: string | null }) {
  const chainQ = useApiQuery<OptionChainResponse>(optionsPath(underlying, expiry), 8000);
  const exp = expiry || chainQ.data?.chain?.expiry || "";
  const oiQ = useApiQuery<OptionOiResponse>(exp ? optionsOiPath(underlying, exp) : null, 8000);
  const chain = chainQ.data?.chain;
  if (chainQ.status === "loading" && !chain) return <LoadingState />;
  return (
    <StrikeOIChart
      strikes={chain?.strikes}
      multi={oiQ.data?.oi?.multi_strike ?? chain?.multi_strike}
      maxPain={chain?.max_pain?.max_pain_strike ?? oiQ.data?.oi?.max_pain?.max_pain_strike}
    />
  );
}

function UnusualTab({ symbol }: { symbol: string }) {
  const q = useApiQuery<UnusualActivityResponse>(unusualActivityPath(50), 8000);
  const rows = (q.data?.unusual_activity ?? []).filter(
    (r) => !r.symbol || r.symbol.toUpperCase() === symbol.toUpperCase(),
  );
  if (q.status === "loading" && !q.data) return <LoadingState />;
  return <UnusualActivityTable rows={rows} />;
}
