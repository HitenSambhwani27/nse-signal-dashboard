"use client";

import { useEffect } from "react";
import type { Candle } from "@/lib/candles";
import { CANDLE_BACKEND_NOTE } from "@/lib/candles";
import { EmptyState } from "@/components/data/States";
import { useChartHost } from "@/components/charts/chartTheme";
import type { UTCTimestamp } from "lightweight-charts";

export function CandlestickChart({ candles }: { candles: Candle[] | null }) {
  const { host, api } = useChartHost();
  useEffect(() => {
    const chart = api.current;
    if (!chart || !candles?.length) return;
    const series = chart.addCandlestickSeries({
      upColor: "#3dd68c",
      downColor: "#f07178",
      borderVisible: false,
      wickUpColor: "#3dd68c",
      wickDownColor: "#f07178",
    });
    series.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chart.timeScale().fitContent();
    return () => {
      chart.removeSeries(series);
    };
  }, [api, candles]);
  return (
    <div className="chart-host">
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      {!candles?.length ? (
        <div className="chart-overlay">
          <EmptyState
            title="Historical candle data unavailable"
            detail={CANDLE_BACKEND_NOTE}
          />
        </div>
      ) : null}
    </div>
  );
}
