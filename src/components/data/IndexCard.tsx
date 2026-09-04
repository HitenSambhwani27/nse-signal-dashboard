import type { Quote } from "@/api/types";
import { formatInr, formatPct, signedTone } from "@/lib/format";
import { displayName, symbolHref } from "@/lib/instruments";
import Link from "next/link";

export function IndexCard({
  label,
  quote,
  href,
}: {
  label: string;
  quote: Quote | null;
  href?: string;
}) {
  const tone = signedTone(quote?.change);
  const inner = (
    <div className="index-card">
      <div>
        <div className="name">{label}</div>
        <div className="price-xl" style={{ fontSize: 22 }}>
          {formatInr(quote?.last_price)}
        </div>
      </div>
      <div className={`chg ${tone}`} style={{ textAlign: "right" }}>
        <div>{formatPct(quote?.change_pct)}</div>
        <div className="page-sub">{quote?.timestamp ? "as of snapshot" : "no snapshot"}</div>
      </div>
    </div>
  );
  const to = href ?? (quote?.symbol ? symbolHref(quote.symbol) : undefined);
  return to ? <Link href={to}>{inner}</Link> : inner;
}

export function displayIndex(quote: Quote | null, fallback: string): string {
  return quote?.symbol ? displayName(quote.symbol) : fallback;
}
