"use client";

import { useMemo, useState } from "react";
import { chartsPath } from "@/api/charts";
import { watchlistsPath } from "@/api/watchlists";
import type { ChartsResponse, WatchlistsResponse } from "@/api/types";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { PriceChart } from "@/components/charts/PriceChart";
import { ActivityChart, OIChart, OIDeltaChart, VolumeChart, VolumeDeltaChart } from "@/components/charts/VolumeChart";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { ErrorState, LoadingState } from "@/components/data/States";
import { useApiQuery } from "@/hooks/useApiQuery";
import { extractCandles, pointsOnSessionDate, resolveDisplayedPoints } from "@/lib/candles";
import { CHART_TIMEFRAMES, INDEX_INSTRUMENTS, type ChartTimeframe } from "@/lib/instruments";

export default function ChartsIndexPage() {
  const lists = useApiQuery<WatchlistsResponse>(watchlistsPath(), 30_000);
  const symbols = useMemo(() => {
    const set = new Set<string>(INDEX_INSTRUMENTS.map((i) => i.spotSymbol));
    for (const list of lists.data?.watchlists ?? []) for (const s of list.symbols ?? []) set.add(s);
    return [...set];
  }, [lists.data]);
  const [symbol, setSymbol] = useState("NIFTY 50");
  const [tf, setTf] = useState<ChartTimeframe>("1D");
  const [series, setSeries] = useState<"price" | "volume" | "oi" | "oi_delta" | "volume_delta" | "candle">("price");
  const q = useApiQuery<ChartsResponse>(chartsPath(symbol, tf), 8000);
  const chart = q.data?.chart;
  const resolved = resolveDisplayedPoints(chart?.points ?? [], tf);
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
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Charts</h1>
          <p className="page-sub">
            GET /api/v1/charts/{`{symbol}`} returns downsampled observations (last_price, volume, OI). Candlesticks render only if OHLC fields exist.
          </p>
        </div>
        <DataFreshnessBadge asOf={q.data?.as_of} />
      </div>
      <div className="row">
        <select className="btn" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {symbols.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="seg">
          {CHART_TIMEFRAMES.map((item) => (
            <button key={item} className={`btn ${tf === item ? "active" : ""}`} onClick={() => setTf(item)}>
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
      </div>
      {q.status === "error" && !q.data ? <ErrorState detail={q.error} /> : null}
      {q.status === "loading" && !q.data ? (
        <LoadingState />
      ) : (
        <ChartPanel
          title={`${symbol} · ${series} · ${tf}`}
          extra={
            <span className="page-sub">
              {resolved.mode === "last_session"
                ? `Last available session: ${resolved.sessionDate}`
                : resolved.mode === "empty"
                  ? "No observations in the selected window"
                  : q.data?.chart?.interval
                    ? `interval ${q.data.chart.interval}`
                    : null}
              {q.data?.chart?.downsampled
                ? ` · downsampled ${q.data.chart.returned_points}/${q.data.chart.observation_count}`
                : null}
            </span>
          }
        >
          {series === "price" ? <PriceChart points={points} /> : null}
          {series === "volume" ? <VolumeChart points={points} /> : null}
          {series === "oi" ? <OIChart points={points} /> : null}
          {series === "oi_delta" ? <OIDeltaChart points={points} /> : null}
          {series === "volume_delta" ? <VolumeDeltaChart points={points} /> : null}
          {series === "candle" ? <CandlestickChart candles={candles} /> : null}
        </ChartPanel>
      )}
      <ActivityChart points={points} />
    </div>
  );
}
