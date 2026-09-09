"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { CHART_LAYOUT } from "@/components/charts/chartTheme";
import { phase6aAsChartCandles } from "@/fixtures/phase6a";
import { formatNumber } from "@/lib/format";
import { useTerminal } from "@/terminal/context";

export function TerminalChart() {
  const { selectedInstrument, selectedTimeframe } = useTerminal();
  const candles = useMemo(
    () => phase6aAsChartCandles(selectedInstrument.symbol),
    [selectedInstrument.symbol],
  );
  const host = useRef<HTMLDivElement>(null);
  const last = candles[candles.length - 1];

  useEffect(() => {
    const el = host.current;
    if (!el || !candles.length) return;
    let chart: IChartApi | null = createChart(el, {
      ...CHART_LAYOUT,
      layout: {
        ...CHART_LAYOUT.layout,
        background: { type: ColorType.Solid, color: "#0a0c10" },
      },
      width: Math.max(el.clientWidth, 100),
      height: Math.max(el.clientHeight, 280),
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#3dd68c",
      downColor: "#f07178",
      borderVisible: false,
      wickUpColor: "#3dd68c",
      wickDownColor: "#f07178",
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(61,214,140,0.45)",
    });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? "rgba(61,214,140,0.45)" : "rgba(240,113,120,0.45)",
      })),
    );
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.04, bottom: 0.22 },
    });
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (!el || !chart) return;
      chart.applyOptions({
        width: Math.max(el.clientWidth, 100),
        height: Math.max(el.clientHeight, 280),
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart?.remove();
      chart = null;
    };
  }, [candles, selectedTimeframe]);

  return (
    <div className="pulse-chart-host">
      {last ? (
        <div className="pulse-ohlc" aria-hidden>
          <span>O {formatNumber(last.open)}</span>
          <span>H {formatNumber(last.high)}</span>
          <span>L {formatNumber(last.low)}</span>
          <span>C {formatNumber(last.close)}</span>
        </div>
      ) : null}
      <div ref={host} className="pulse-chart-canvas" />
    </div>
  );
}
