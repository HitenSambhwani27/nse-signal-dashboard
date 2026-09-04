"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartPoint } from "@/api/types";

export const CHART_LAYOUT = {
  layout: {
    background: { type: ColorType.Solid, color: "#0c1017" },
    textColor: "#7d8aa3",
    fontFamily: "IBM Plex Mono, Consolas, monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "#1b2433" },
    horzLines: { color: "#1b2433" },
  },
  crosshair: { mode: 1 as const },
  rightPriceScale: { borderColor: "#243044" },
  timeScale: { borderColor: "#243044", timeVisible: true, secondsVisible: true },
};

export function toUtc(iso: string | null | undefined): UTCTimestamp | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000) as UTCTimestamp;
}

export function linePoints(
  points: ChartPoint[],
  field: keyof ChartPoint,
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (const p of points) {
    const time = toUtc(p.timestamp);
    const value = p[field];
    if (time == null || typeof value !== "number" || Number.isNaN(value)) continue;
    out.push({ time, value });
  }
  return out;
}

export function useChartHost() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<IChartApi | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      ...CHART_LAYOUT,
      width: host.current.clientWidth,
      height: host.current.clientHeight,
    });
    api.current = chart;
    const ro = new ResizeObserver(() => {
      if (!host.current) return;
      chart.applyOptions({
        width: host.current.clientWidth,
        height: host.current.clientHeight,
      });
    });
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      chart.remove();
      api.current = null;
    };
  }, []);
  return { host, api };
}
