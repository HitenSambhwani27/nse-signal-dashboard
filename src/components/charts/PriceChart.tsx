"use client";

import { useEffect } from "react";
import type { ChartPoint } from "@/api/types";
import { EmptyState } from "@/components/data/States";
import { linePoints, useChartHost } from "@/components/charts/chartTheme";

export function PriceChart({
  points,
  empty = "Awaiting price series",
}: {
  points: ChartPoint[];
  empty?: string;
}) {
  const { host, api } = useChartHost();
  useEffect(() => {
    const chart = api.current;
    const seriesData = linePoints(points, "last_price");
    if (!chart || !seriesData.length) return;
    const series = chart.addLineSeries({
      color: "#c4a35a",
      lineWidth: 2,
      priceLineVisible: false,
    });
    series.setData(seriesData);
    chart.timeScale().fitContent();
    return () => {
      chart.removeSeries(series);
    };
  }, [api, points]);
  const data = linePoints(points, "last_price");
  return (
    <div className="chart-host">
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      {!data.length ? (
        <div className="chart-overlay">
          <EmptyState title={empty} detail="Backend observations only — no synthetic series." />
        </div>
      ) : null}
    </div>
  );
}
