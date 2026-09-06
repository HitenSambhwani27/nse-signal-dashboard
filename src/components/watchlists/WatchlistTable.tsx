"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Watchlist, WatchlistQuoteRow } from "@/api/types";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import { formatInr, formatOi, formatPct, formatSigned, formatVolume, signedTone } from "@/lib/format";
import { symbolHref } from "@/lib/instruments";
import { DataFreshnessBadge } from "@/components/data/Badges";

export function WatchlistTable({
  lists,
  quotes,
}: {
  lists: Watchlist[];
  quotes: WatchlistQuoteRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(lists[0]?.name || "default");
  const [q, setQ] = useState("");
  const current = lists.find((l) => l.name === selected) ?? lists[0];
  const bySymbol = useMemo(() => {
    const map = new Map<string, WatchlistQuoteRow>();
    for (const row of quotes) map.set(row.symbol, row);
    return map;
  }, [quotes]);

  const rows = useMemo(() => {
    const symbols = current?.symbols ?? quotes.map((r) => r.symbol);
    const needle = q.trim().toUpperCase();
    return symbols
      .filter((s) => !needle || s.toUpperCase().includes(needle))
      .map((symbol) => bySymbol.get(symbol) ?? { symbol, quote: null, found: false });
  }, [current, quotes, bySymbol, q]);

  const columns: Column<WatchlistQuoteRow>[] = [
    { key: "symbol", header: "Symbol", render: (r) => r.symbol, sortValue: (r) => r.symbol },
    {
      key: "ltp",
      header: "LTP",
      align: "right",
      render: (r) => formatInr(r.quote?.last_price),
      sortValue: (r) => r.quote?.last_price ?? null,
    },
    {
      key: "chg",
      header: "Change",
      align: "right",
      render: (r) => (
        <span className={`num ${signedTone(r.quote?.change)}`}>{formatSigned(r.quote?.change)}</span>
      ),
      sortValue: (r) => r.quote?.change ?? null,
    },
    {
      key: "pct",
      header: "Change %",
      align: "right",
      render: (r) => (
        <span className={`num ${signedTone(r.quote?.change_pct)}`}>{formatPct(r.quote?.change_pct)}</span>
      ),
      sortValue: (r) => r.quote?.change_pct ?? null,
    },
    {
      key: "vol",
      header: "Volume",
      align: "right",
      render: (r) => formatVolume(r.quote?.volume),
      sortValue: (r) => r.quote?.volume ?? null,
    },
    {
      key: "oi",
      header: "OI",
      align: "right",
      render: (r) =>
        r.quote?.missing_fields?.includes("oi") ? "—" : formatOi(r.quote?.oi),
      sortValue: (r) => r.quote?.oi ?? null,
    },
    {
      key: "act",
      header: "Activity",
      align: "right",
      render: (r) => formatVolume(r.quote?.volume_delta),
      sortValue: (r) => r.quote?.volume_delta ?? null,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.found && r.quote ? (
          <DataFreshnessBadge asOf={r.quote.timestamp} />
        ) : (
          <span className="badge muted">No snapshot</span>
        ),
    },
  ];

  return (
    <div className="stack">
      <div className="row">
        {lists.map((list) => (
          <button
            key={String(list.id ?? list.name)}
            className={`btn ${list.name === current?.name ? "active" : ""}`}
            onClick={() => setSelected(list.name || "")}
          >
            {list.name} ({list.symbols?.length ?? 0})
          </button>
        ))}
        <input
          className="btn"
          style={{ width: 180 }}
          placeholder="Filter symbol"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <FinancialTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.symbol}
        onRowClick={(r) => router.push(symbolHref(r.symbol))}
        empty="No watchlist symbols"
        compact
      />
    </div>
  );
}
