import type { Quote } from "@/api/types";
import { formatInt, formatInr } from "@/lib/format";
import { EmptyState } from "@/components/data/States";

export function DepthChart({ quote }: { quote: Quote | null }) {
  const missing = quote?.missing_fields?.includes("depth");
  const has =
    quote &&
    !missing &&
    (quote.bid_depth_5 != null ||
      quote.ask_depth_5 != null ||
      quote.best_bid != null ||
      quote.best_ask != null);
  if (!quote || !has) {
    return (
      <EmptyState
        title="Depth unavailable for this instrument"
        detail="The snapshot has no displayed bid/ask depth. A full ladder (orders per level) is not in this API."
      />
    );
  }
  const bid = quote.bid_depth_5 ?? 0;
  const ask = quote.ask_depth_5 ?? 0;
  const tot = bid + ask || 1;
  return (
    <div className="panel">
      <div className="panel-h">
        <span>Displayed depth (top 5 aggregate)</span>
        <span className="num muted">
          imb {quote.depth_imbalance == null ? "—" : quote.depth_imbalance.toFixed(3)}
        </span>
      </div>
      <div className="panel-b">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 88px 1fr",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div>
            <div className="k">Bid qty</div>
            <div
              style={{
                height: 10,
                background: "#3dd68c",
                width: `${(bid / tot) * 100}%`,
                marginLeft: "auto",
              }}
            />
            <div className="num">{formatInt(quote.bid_depth_5)}</div>
          </div>
          <div className="num" style={{ textAlign: "center" }}>
            {formatInr(quote.best_bid)}
            <div className="page-sub">/</div>
            {formatInr(quote.best_ask)}
          </div>
          <div>
            <div className="k">Ask qty</div>
            <div style={{ height: 10, background: "#f07178", width: `${(ask / tot) * 100}%` }} />
            <div className="num">{formatInt(quote.ask_depth_5)}</div>
          </div>
        </div>
        <div className="grid-4" style={{ marginTop: 12 }}>
          <div className="metric">
            <div className="k">Bid orders</div>
            <div className="v null">N/A</div>
          </div>
          <div className="metric">
            <div className="k">Ask orders</div>
            <div className="v null">N/A</div>
          </div>
          <div className="metric">
            <div className="k">Bid qty (best)</div>
            <div className="v num">{formatInt(quote.best_bid_quantity)}</div>
          </div>
          <div className="metric">
            <div className="k">Ask qty (best)</div>
            <div className="v num">{formatInt(quote.best_ask_quantity)}</div>
          </div>
        </div>
        <p className="page-sub" style={{ marginTop: 8 }}>
          Per-level order counts are not returned by GET /api/v1/quotes. Totals are displayed book size, not executed buy/sell.
        </p>
      </div>
    </div>
  );
}
