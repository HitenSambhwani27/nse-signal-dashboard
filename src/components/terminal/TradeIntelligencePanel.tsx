"use client";

import {
  DASH,
  formatNumber,
  formatPct,
  formatSigned,
  formatTime,
  formatVolume,
} from "@/lib/format";
import { useInstrumentQuote, useLiveStatus, useMarketSession } from "@/market/hooks";
import { Badge, PanelHead } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";
import type { LiveStatusKind } from "@/market/hooks";

const STATUS_TONE: Record<LiveStatusKind, "up" | "down" | "warn" | "neutral"> = {
  live: "up",
  partial: "warn",
  stale: "warn",
  reconnecting: "warn",
  connecting: "neutral",
  disconnected: "down",
  idle: "neutral",
};

/**
 * Phase 6B scope: this panel carries live market context for the selected
 * instrument. Bias, probability and model maturity are Phase 6C and are shown
 * as explicitly unavailable rather than approximated here.
 */
export function TradeIntelligencePanel() {
  const { selectedInstrument, selectedToken } = useTerminal();
  const quote = useInstrumentQuote(selectedToken);
  const session = useMarketSession();
  const status = useLiveStatus();

  return (
    <aside className="pulse-intel" aria-label="Trade intelligence">
      <PanelHead
        title="Trade intelligence"
        meta={<span className="pulse-meta">Live context</span>}
      />
      <div className="pulse-intel-body">
        <div className="pulse-intel-kicker">
          MARKET CONTEXT · {selectedInstrument.shortName}
        </div>
        <div className="pulse-bias-row">
          <div className="pulse-px num">{formatNumber(quote?.ltp)}</div>
          <Badge tone={STATUS_TONE[status.kind]}>{status.label}</Badge>
        </div>

        <div className="pulse-levels">
          <ContextRow
            label="Change"
            value={
              quote?.change == null
                ? DASH
                : `${formatSigned(quote.change)} (${formatPct(quote.changePct)})`
            }
          />
          <ContextRow label="Volume" value={formatVolume(quote?.volume)} />
          <ContextRow label="Open interest" value={formatVolume(quote?.oi)} />
          <ContextRow label="Bid / Ask" value={
            quote?.bid == null && quote?.ask == null
              ? DASH
              : `${formatNumber(quote?.bid)} / ${formatNumber(quote?.ask)}`
          } />
          <ContextRow label="Exchange time" value={formatTime(quote?.timestamp)} />
          <ContextRow label="Source" value={quote === null ? DASH : quote.origin} />
          <ContextRow label="Session" value={session?.marketState ?? DASH} />
          <ContextRow label="Coverage" value={session?.coverage ?? DASH} />
        </div>

        <div className="pulse-unavailable">
          Directional bias
          <strong>Unavailable</strong>
          <span>
            Bias, probability and model maturity require the Phase 6C inference layer, which is
            not implemented. No estimate is shown in its place.
          </span>
        </div>
      </div>
    </aside>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pulse-level-row">
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
