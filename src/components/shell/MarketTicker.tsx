import Link from "next/link";
import type { Quote } from "@/api/types";
import { formatInr, formatPct, signedTone } from "@/lib/format";
import { INDEX_INSTRUMENTS, symbolHref } from "@/lib/instruments";

export function MarketTicker({
  nifty,
  banknifty,
}: {
  nifty: Quote | null;
  banknifty: Quote | null;
}) {
  const items = [
    { meta: INDEX_INSTRUMENTS[0], quote: nifty },
    { meta: INDEX_INSTRUMENTS[1], quote: banknifty },
  ];
  return (
    <div className="ticker">
      {items.map(({ meta, quote }) => {
        const tone = signedTone(quote?.change);
        return (
          <Link key={meta.underlying} className="ticker-item" href={symbolHref(meta.spotSymbol)}>
            <span className="ticker-sym">{meta.label}</span>
            <span className="ticker-px">{formatInr(quote?.last_price)}</span>
            <span className={`chg ${tone}`}>{formatPct(quote?.change_pct)}</span>
          </Link>
        );
      })}
    </div>
  );
}
