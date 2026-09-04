"use client";

import { useEffect } from "react";
import type { ChartPoint } from "@/api/types";
import { EmptyState } from "@/components/data/States";
import { linePoints, useChartHost } from "@/components/charts/chartTheme";

export function HistogramChart({
  points,
  field,
  color = "#7eb6ff",
  empty = "No series",
}: {
  points: ChartPoint[];
  field: keyof ChartPoint;
  color?: string;
  empty?: string;
}) {
  const { host, api } = useChartHost();
  useEffect(() => {
    const chart = api.current;
    const seriesData = linePoints(points, field);
    if (!chart || !seriesData.length) return;
    const series = chart.addHistogramSeries({
      color,
      priceFormat: { type: "volume" },
    });
    series.setData(seriesData);
    chart.timeScale().fitContent();
    return () => {
      chart.removeSeries(series);
    };
  }, [api, color, field, points]);
  const data = linePoints(points, field);
  return (
    <div className="chart-host sm">
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      {!data.length ? (
        <div className="chart-overlay">
          <EmptyState title={empty} />
        </div>
      ) : null}
    </div>
  );
}

export function VolumeChart({ points }: { points: ChartPoint[] }) {
  return <HistogramChart points={points} field="volume" color="#3d5a80" empty="Volume series unavailable" />;
}

export function OIChart({ points }: { points: ChartPoint[] }) {
  return <HistogramChart points={points} field="oi" color="#c4a35a" empty="OI series unavailable" />;
}

export function OIDeltaChart({ points }: { points: ChartPoint[] }) {
  return <HistogramChart points={points} field="oi_delta" color="#e6b450" empty="OI delta series unavailable" />;
}

export function VolumeDeltaChart({ points }: { points: ChartPoint[] }) {
  return (
    <HistogramChart
      points={points}
      field="volume_delta"
      color="#7eb6ff"
      empty="Volume delta series unavailable"
    />
  );
}

export function ActivityChart({ points }: { points: ChartPoint[] }) {
  return (
    <HistogramChart
      points={points}
      field="trade_notional"
      color="#7eb6ff"
      empty="Trade activity series unavailable"
    />
  );
}
