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
import { Badge } from "@/components/terminal/primitives";
import { EmptyState } from "@/components/data/States";
import { useTerminal } from "@/terminal/context";
import type { WorkspaceId } from "@/terminal/types";

/**
 * Phase 6B scope: live market context for the selected instrument. The
 * inference surface (bias, probability, maturity, recommendations) is Phase 6C.
 */
export function IntelligenceWorkspace() {
  const { selectedInstrument, selectedToken } = useTerminal();
  const quote = useInstrumentQuote(selectedToken);
  const session = useMarketSession();
  const status = useLiveStatus();

  return (
    <section className="pulse-ws pulse-intel-ws" aria-label="Intelligence workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">TRADE INTELLIGENCE / LIVE CONTEXT</div>
          <div className="pulse-inst-name">
            {selectedInstrument.shortName}
            <span className="pulse-chip">NSE</span>
          </div>
          <div className="pulse-inst-meta">
            {session ? `Session ${session.marketState}` : "Awaiting session"}
            <span>Coverage {session?.coverage ?? DASH}</span>
            <span>Updated {formatTime(quote?.timestamp)}</span>
          </div>
        </div>
        <Badge tone={status.kind === "live" ? "up" : "warn"}>{status.label}</Badge>
      </header>

      <div className="pulse-intel-grid">
        <div>
          <div className="pulse-intel-kicker">LAST TRADED PRICE</div>
          <div className="pulse-px num">{formatNumber(quote?.ltp)}</div>
          <div className="pulse-px-chg">
            {quote?.change == null
              ? "Change unavailable"
              : `${formatSigned(quote.change)} (${formatPct(quote.changePct)})`}
          </div>
        </div>
        <div className="pulse-unavailable">
          Probability <strong>Unavailable</strong>
          <span>
            No probability model, bias engine or strategy scoring exists in Phase 6B. These are
            Phase 6C deliverables and are deliberately not approximated.
          </span>
        </div>
      </div>

      <div className="pulse-intel-cols">
        <ContextCard
          title="Traded context"
          rows={[
            ["Volume", formatVolume(quote?.volume)],
            ["Open interest", formatVolume(quote?.oi)],
            ["Bid", formatNumber(quote?.bid)],
            ["Ask", formatNumber(quote?.ask)],
          ]}
        />
        <ContextCard
          title="Instrument"
          rows={[
            ["Token", quote === null ? DASH : String(quote.token)],
            ["Type", quote?.meta.instrumentType ?? selectedInstrument.kind],
            ["Lot size", quote?.meta.lotSize == null ? DASH : String(quote.meta.lotSize)],
            ["Tick size", quote?.meta.tickSize == null ? DASH : quote.meta.tickSize.toFixed(2)],
          ]}
        />
        <ContextCard
          title="Stream"
          rows={[
            ["Status", status.label],
            ["Ingest lag", status.lagMs == null ? DASH : `${Math.round(status.lagMs)} ms`],
            ["Origin", quote?.origin ?? DASH],
            ["Sequence", quote?.seq == null ? DASH : String(quote.seq)],
          ]}
        />
        <ContextCard
          title="Session"
          rows={[
            ["State", session?.marketState ?? DASH],
            ["Coverage", session?.coverage ?? DASH],
            ["Session date", session?.sessionDate ?? DASH],
            ["Detail", status.detail ?? "None reported"],
          ]}
        />
      </div>
    </section>
  );
}

function ContextCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="pulse-intel-block">
      <h3>{title}</h3>
      <div className="pulse-levels">
        {rows.map(([label, value]) => (
          <div key={label} className="pulse-level-row">
            <span>{label}</span>
            <span className="num">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlaceholderWorkspace({
  workspace,
  title,
}: {
  workspace: WorkspaceId;
  title: string;
}) {
  return (
    <section className="pulse-ws" aria-label={`${title} workspace`}>
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">{workspace.toUpperCase()}</div>
          <h2 className="pulse-ws-title">{title}</h2>
        </div>
      </header>
      <EmptyState
        title="Not connected"
        detail={`${title} is a navigation shell only. No live screener, alerts engine, or portfolio state is connected.`}
      />
    </section>
  );
}
