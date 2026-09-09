"use client";

import { Badge } from "@/components/terminal/primitives";
import { EmptyState } from "@/components/data/States";
import { useTerminal } from "@/terminal/context";
import type { WorkspaceId } from "@/terminal/types";

export function IntelligenceWorkspace() {
  const { intelligence, selectedInstrument } = useTerminal();
  const maturityPct = Math.min(
    100,
    (intelligence.pooledLiveDays / intelligence.thresholdDays) * 100,
  );
  return (
    <section className="pulse-ws pulse-intel-ws" aria-label="Intelligence workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">TRADE INTELLIGENCE / CONTEXT SHELL</div>
          <div className="pulse-inst-name">
            {selectedInstrument.shortName}
            <span className="pulse-chip">NSE</span>
          </div>
        </div>
        <Badge tone="warn">{intelligence.confidence} confidence</Badge>
      </header>
      <div className="pulse-intel-grid">
        <div>
          <div className="pulse-intel-kicker">CURRENT BIAS</div>
          <div className="pulse-bias up">
            {intelligence.bias} <span aria-hidden>↗</span>
          </div>
          <div className="pulse-unavailable">
            Probability <strong>Unavailable</strong>
            <span>{intelligence.probabilityReason}</span>
          </div>
        </div>
        <div className="pulse-maturity">
          <div className="pulse-maturity-h">
            Model maturity
            <span>
              {intelligence.pooledLiveDays} / {intelligence.thresholdDays} pooled live days
            </span>
          </div>
          <div className="pulse-meter" aria-hidden>
            <span style={{ width: `${maturityPct}%` }} />
          </div>
        </div>
      </div>
      <div className="pulse-intel-cols">
        <IntelCard section={intelligence.entry} />
        <IntelCard section={intelligence.exit} />
        <IntelCard section={intelligence.evidence} />
        <IntelCard section={intelligence.contradictions} />
      </div>
    </section>
  );
}

function IntelCard({ section }: { section: { title: string; body: string } }) {
  return (
    <section className="pulse-intel-block">
      <h3>{section.title}</h3>
      <p>{section.body}</p>
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
        title="Unavailable in Phase 6A"
        detail={`${title} is a navigation shell only. No live screener, alerts engine, or portfolio state is connected.`}
      />
    </section>
  );
}
