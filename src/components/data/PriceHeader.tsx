import type { ReactNode } from "react";
import type { Quote } from "@/api/types";
import { formatInr, formatPct, formatSigned, signedTone } from "@/lib/format";
import { DataFreshnessBadge, StatusBadge } from "@/components/data/Badges";

export function PriceHeader({
  symbol,
  quote,
  extra,
}: {
  symbol: string;
  quote: Quote | null;
  extra?: ReactNode;
}) {
  const px = formatInr(quote?.last_price);
  const chg = formatSigned(quote?.change);
  const pct = formatPct(quote?.change_pct);
  const tone = signedTone(quote?.change);
  return (
    <div className="page-head">
      <div>
        <div className="page-sub">{symbol}</div>
        <h1 className="page-title" style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span className="price-xl">{px}</span>
          <span className={`chg ${tone}`}>
            {chg} ({pct})
          </span>
        </h1>
      </div>
      <div className="row">
        <DataFreshnessBadge asOf={quote?.timestamp ?? quote?.ingested_at} />
        {quote?.subscribe_mode ? <StatusBadge>{quote.subscribe_mode}</StatusBadge> : null}
        {extra}
      </div>
    </div>
  );
}
