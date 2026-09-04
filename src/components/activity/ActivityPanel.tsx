import type { MarketActivityResponse } from "@/api/types";
import { MetricCard } from "@/components/data/MetricCard";
import { EmptyState } from "@/components/data/States";
import { SeverityBadge, StatusBadge } from "@/components/data/Badges";
import {
  formatInr,
  formatNotional,
  formatNumber,
  formatOi,
  formatQty,
  formatTimestamp,
  formatVolume,
} from "@/lib/format";

export function ActivityPanel({ payload }: { payload: MarketActivityResponse | null }) {
  if (!payload || !payload.found || !payload.activity) {
    return (
      <EmptyState
        title="No market activity available"
        detail="No activity sample for this symbol. Empty during a closed session is expected."
      />
    );
  }
  const a = payload.activity;
  const unusual = payload.unusual;
  return (
    <div className="stack">
      {a.note ? <p className="page-sub">{a.note}</p> : null}
      <div className="grid-4">
        <MetricCard label="Last qty" value={formatQty(a.last_quantity)} />
        <MetricCard label="Trade notional" value={formatNotional(a.trade_notional)} />
        <MetricCard label="Size (lots)" value={formatNumber(a.trade_size_lots, 2)} />
        <MetricCard
          label="Size percentile"
          value={a.trade_size_percentile == null ? "—" : formatNumber(a.trade_size_percentile, 1)}
        />
        <MetricCard label="Notional percentile" value={a.trade_notional_percentile == null ? "—" : formatNumber(a.trade_notional_percentile, 1)} />
        <MetricCard label="Volume" value={formatVolume(a.volume)} />
        <MetricCard label="Volume delta" value={formatVolume(a.volume_delta)} />
        <MetricCard label="Volume level" value={a.volume_level ?? "—"} />
        <MetricCard label="Volume ratio" value={a.volume_ratio == null ? "—" : `${a.volume_ratio.toFixed(2)}x`} />
        <MetricCard label="Txn frequency level" value={a.activity_level ?? "—"} />
        <MetricCard label="Depth imbalance" value={a.depth_imbalance == null ? "—" : a.depth_imbalance.toFixed(3)} />
        <MetricCard label="Large trade" value={a.large_trade ?? "—"} />
        <MetricCard label="OI" value={formatOi(a.oi)} />
        <MetricCard label="OI delta" value={formatOi(a.oi_delta)} />
        <MetricCard label="Spread" value={formatInr(a.spread)} />
        <MetricCard label="As of" value={formatTimestamp(a.timestamp)} />
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-h">Observed liquidity</div>
          <div className="panel-b">
            <div className="row">
              {(payload.liquidity_events ?? []).length ? (
                payload.liquidity_events!.map((ev) => (
                  <StatusBadge key={ev} tone="warning">
                    {ev.replaceAll("_", " ")}
                  </StatusBadge>
                ))
              ) : (
                <span className="null">No liquidity events on this snapshot</span>
              )}
            </div>
            <div className="grid-4" style={{ marginTop: 12 }}>
              <MetricCard label="Bid added" value={formatQty(payload.displayed_depth_changes?.bid_quantity_added)} />
              <MetricCard label="Bid removed" value={formatQty(payload.displayed_depth_changes?.bid_quantity_removed)} />
              <MetricCard label="Ask added" value={formatQty(payload.displayed_depth_changes?.ask_quantity_added)} />
              <MetricCard label="Ask removed" value={formatQty(payload.displayed_depth_changes?.ask_quantity_removed)} />
            </div>
            <p className="page-sub">{payload.displayed_depth_changes?.note}</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">Inferred activity</div>
          <div className="panel-b">
            <div className="row">
              <SeverityBadge level={unusual?.activity_level} />
              <span className="num">{unusual?.activity_score == null ? "—" : unusual.activity_score.toFixed(1)}</span>
              <StatusBadge>
                {payload.aggressive_proxy?.label?.replaceAll("_", " ") ?? "aggressor unknown"}
              </StatusBadge>
            </div>
            <ul style={{ margin: "8px 0", paddingLeft: 16, color: "var(--text-secondary)" }}>
              {(unusual?.reasons ?? []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {payload.price_impact ? <p>{payload.price_impact}</p> : null}
            <p className="page-sub">
              {unusual?.note ||
                "Observed and inferred from displayed book and last trade size. Not a participant-identity claim."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
