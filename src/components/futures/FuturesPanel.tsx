import type { FuturesBook, FuturesContract } from "@/api/types";
import { BasisStatusBadge, DataFreshnessBadge } from "@/components/data/Badges";
import { MetricCard } from "@/components/data/MetricCard";
import { EmptyState } from "@/components/data/States";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import {
  formatAge,
  formatBasis,
  formatInr,
  formatOi,
  formatPct,
  formatRatioPct,
  formatSigned,
  formatTimestamp,
  formatVolume,
  signedTone,
} from "@/lib/format";

export function FuturesPanel({ book }: { book: FuturesBook | null }) {
  if (!book || !book.contracts?.length) {
    return (
      <EmptyState
        title="No futures contracts"
        detail="Backend returned no futures book for this underlying."
      />
    );
  }
  const near = book.contracts[0];
  const columns: Column<FuturesContract>[] = [
    { key: "symbol", header: "Contract", render: (r) => r.symbol ?? "—" },
    { key: "exp", header: "Expiry", render: (r) => r.expiry ?? "—" },
    {
      key: "ltp",
      header: "Futures",
      align: "right",
      render: (r) => formatInr(r.ltp),
      sortValue: (r) => r.ltp ?? null,
    },
    {
      key: "spot",
      header: "Spot",
      align: "right",
      render: (r) => formatInr(r.spot),
    },
    {
      key: "basis",
      header: "Basis",
      align: "right",
      render: (r) => <span className={`num ${signedTone(r.basis)}`}>{formatBasis(r.basis)}</span>,
      sortValue: (r) => r.basis ?? null,
    },
    {
      key: "bpct",
      header: "Basis %",
      align: "right",
      render: (r) => formatPct(r.basis_pct),
    },
    {
      key: "st",
      header: "Basis status",
      render: (r) => <BasisStatusBadge status={r.basis_status} />,
    },
    {
      key: "oi",
      header: "OI",
      align: "right",
      render: (r) => formatOi(r.oi),
    },
    {
      key: "vol",
      header: "Volume",
      align: "right",
      render: (r) => formatVolume(r.volume),
    },
    {
      key: "poi",
      header: "Price / OI",
      render: (r) => r.price_oi?.label?.replaceAll("_", " ") ?? "—",
    },
  ];
  return (
    <div className="stack">
      <div className="grid-4">
        <MetricCard label="Spot" value={formatInr(book.spot)} hint={book.spot_symbol ?? undefined} />
        <MetricCard label="Near futures" value={formatInr(near.ltp)} hint={near.symbol ?? undefined} />
        <MetricCard
          label="Basis"
          value={formatBasis(near.basis)}
          tone={signedTone(near.basis)}
          hint={formatPct(near.basis_pct)}
        />
        <MetricCard
          label="Price / OI"
          value={near.price_oi?.label?.replaceAll("_", " ") ?? "—"}
          hint={near.price_oi?.note ?? undefined}
        />
      </div>
      <div className="grid-4">
        <MetricCard label="Spot as-of" value={formatTimestamp(near.spot_as_of)} />
        <MetricCard label="Futures as-of" value={formatTimestamp(near.futures_as_of)} />
        <MetricCard label="Data age" value={formatAge(near.data_age_seconds)} />
        <div className="metric">
          <div className="k">Status</div>
          <div className="v">
            <BasisStatusBadge status={near.basis_status} />
          </div>
        </div>
      </div>
      <div className="grid-4">
        <MetricCard label="OI" value={formatOi(near.oi)} />
        <MetricCard label="OI change" value={formatSigned(near.oi_change, 0)} tone={signedTone(near.oi_change)} />
        <MetricCard label="OI change %" value={formatRatioPct(near.oi_change_pct)} />
        <MetricCard label="Volume" value={formatVolume(near.volume)} />
        <MetricCard label="Bid" value={formatInr(near.best_bid)} />
        <MetricCard label="Ask" value={formatInr(near.best_ask)} />
        <MetricCard label="Spread" value={formatInr(near.spread)} />
        <MetricCard
          label="Depth imbalance"
          value={near.depth_imbalance == null ? "—" : near.depth_imbalance.toFixed(3)}
        />
      </div>
      <DataFreshnessBadge asOf={near.futures_as_of} stale={near.basis_status === "stale"} />
      <FinancialTable
        rows={book.contracts}
        columns={columns}
        rowKey={(r, i) => r.symbol ?? String(i)}
        empty="No futures contracts"
      />
    </div>
  );
}
