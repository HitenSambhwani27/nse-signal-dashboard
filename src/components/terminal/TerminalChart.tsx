"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { CHART_LAYOUT } from "@/components/charts/chartTheme";
import { formatNumber } from "@/lib/format";
import { useCandles } from "@/market/hooks";
import { useTerminal } from "@/terminal/context";
import type { CandleBar } from "@/worker/protocol";

const NO_BARS: CandleBar[] = [];

const UP = "#3dd68c";
const DOWN = "#f07178";

export function TerminalChart() {
  const { selectedInstrument, selectedTimeframe } = useTerminal();
  const candles = useCandles(selectedInstrument.symbol, selectedTimeframe);
  const bars = candles?.data?.bars ?? NO_BARS;
  const hasBars = bars.length > 0;

  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Chart and both series are created together in one effect. Splitting them
  // was the Phase 6A rendering bug; that fix is preserved here deliberately.
  useEffect(() => {
    const el = host.current;
    if (!el || !hasBars) return;

    const chart = createChart(el, {
      ...CHART_LAYOUT,
      layout: {
        ...CHART_LAYOUT.layout,
        background: { type: ColorType.Solid, color: "#0a0c10" },
      },
      width: Math.max(el.clientWidth, 100),
      height: Math.max(el.clientHeight, 280),
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(61,214,140,0.45)",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.04, bottom: 0.22 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const observer = new ResizeObserver(() => {
      chart.applyOptions({
        width: Math.max(el.clientWidth, 100),
        height: Math.max(el.clientHeight, 280),
      });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [hasBars]);

  // Data updates reuse the existing chart instance — no teardown per update.
  useEffect(() => {
    const candleSeries = candleRef.current;
    const volumeSeries = volumeRef.current;
    if (!candleSeries || !volumeSeries || bars.length === 0) return;
    candleSeries.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );
    volumeSeries.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? "rgba(61,214,140,0.45)" : "rgba(240,113,120,0.45)",
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  if (!hasBars) {
    return (
      <div className="pulse-chart-host">
        <div className="pulse-chart-unavailable" role="status">
          <strong>Chart unavailable</strong>
          <span>{unavailableReason(candles?.status, candles?.data?.reason ?? candles?.reason)}</span>
          <span className="pulse-meta">
            {selectedInstrument.shortName} · {selectedTimeframe}
          </span>
        </div>
      </div>
    );
  }

  const last = bars[bars.length - 1];
  return (
    <div className="pulse-chart-host">
      <div className="pulse-ohlc" aria-hidden>
        <span>O {formatNumber(last.open)}</span>
        <span>H {formatNumber(last.high)}</span>
        <span>L {formatNumber(last.low)}</span>
        <span>C {formatNumber(last.close)}</span>
      </div>
      <div ref={host} className="pulse-chart-canvas" />
    </div>
  );
}

/** Surfaces the backend's own reason rather than a generic empty message. */
function unavailableReason(status: string | undefined, reason: string | null | undefined): string {
  if (status === "loading" || status === "idle") return "Requesting candles…";
  switch (reason) {
    case "bars_not_built":
      return "The pipeline has not built OHLC bars for this instrument.";
    case "unsupported_interval":
      return "This interval is not supported by the candles endpoint.";
    case "unreachable":
      return "The pipeline API is unreachable.";
    case null:
    case undefined:
      return "No candles returned for this instrument and interval.";
    default:
      return reason;
  }
}
