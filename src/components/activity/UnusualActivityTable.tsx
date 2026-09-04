"use client";

import { useRouter } from "next/navigation";
import type { UnusualActivityRow } from "@/api/types";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import { SeverityBadge } from "@/components/data/Badges";
import { formatInr, formatNotional, formatNumber, formatPct, formatQty, formatTimestamp, formatVolume } from "@/lib/format";
import { symbolHref } from "@/lib/instruments";

export function UnusualActivityTable({ rows }: { rows: UnusualActivityRow[] }) {
  const router = useRouter();
  const columns: Column<UnusualActivityRow>[] = [
    { key: "symbol", header: "Symbol", render: (r) => r.symbol ?? "—", sortValue: (r) => r.symbol ?? null },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (r) => formatInr(r.price),
      sortValue: (r) => r.price ?? null,
    },
    {
      key: "chg",
      header: "Change",
      align: "right",
      render: (r) => formatPct(r.change),
      sortValue: (r) => r.change ?? null,
    },
    {
      key: "vol",
      header: "Volume",
      align: "right",
      render: (r) => formatVolume(r.volume),
      sortValue: (r) => r.volume ?? null,
    },
    {
      key: "size",
      header: "Trade size",
      align: "right",
      render: (r) => formatQty(r.last_quantity),
      sortValue: (r) => r.last_quantity ?? null,
    },
    {
      key: "notional",
      header: "Notional",
      align: "right",
      render: (r) => formatNotional(r.trade_notional),
      sortValue: (r) => r.trade_notional ?? null,
    },
    {
      key: "pct",
      header: "Percentile",
      align: "right",
      render: (r) => (r.trade_size_percentile == null ? "—" : formatNumber(r.trade_size_percentile, 1)),
      sortValue: (r) => r.trade_size_percentile ?? null,
    },
    {
      key: "imb",
      header: "Depth imb.",
      align: "right",
      render: (r) => (r.depth_imbalance == null ? "—" : r.depth_imbalance.toFixed(3)),
      sortValue: (r) => r.depth_imbalance ?? null,
    },
    {
      key: "score",
      header: "Activity score",
      align: "right",
      render: (r) => (
        <span>
          <SeverityBadge level={r.activity_level} />{" "}
          {r.activity_score == null ? "—" : r.activity_score.toFixed(1)}
        </span>
      ),
      sortValue: (r) => r.activity_score ?? null,
    },
    {
      key: "reasons",
      header: "Reasons",
      render: (r) => r.reasons?.join("; ") || "—",
    },
    {
      key: "asof",
      header: "As-of",
      render: (r) => formatTimestamp(r.timestamp),
      sortValue: (r) => r.timestamp ?? null,
    },
  ];
  return (
    <FinancialTable
      rows={rows}
      columns={columns}
      rowKey={(r, i) => `${r.symbol ?? "row"}-${i}`}
      onRowClick={(r) => r.symbol && router.push(symbolHref(r.symbol))}
      empty="No unusual activity available"
    />
  );
}
