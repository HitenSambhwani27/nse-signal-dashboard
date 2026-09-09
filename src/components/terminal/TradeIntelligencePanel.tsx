"use client";

import { Badge, PanelHead } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";

export function TradeIntelligencePanel() {
  const { intelligence, selectedInstrument } = useTerminal();
  const maturityPct = Math.min(
    100,
    (intelligence.pooledLiveDays / intelligence.thresholdDays) * 100,
  );
  return (
    <aside className="pulse-intel" aria-label="Trade intelligence">
      <PanelHead
        title="Trade intelligence"
        meta={<span className="pulse-meta">Context engine · v1.8</span>}
      />
      <div className="pulse-intel-body">
        <div className="pulse-intel-kicker">CURRENT BIAS · {selectedInstrument.shortName}</div>
        <div className="pulse-bias-row">
          <div className="pulse-bias up">
            {intelligence.bias}
            <span aria-hidden>↗</span>
          </div>
          <Badge tone="warn">{intelligence.confidence} confidence</Badge>
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
          <div className="pulse-unavailable">
            Probability
            <strong>Unavailable</strong>
            <span>{intelligence.probabilityReason}</span>
          </div>
        </div>
        <IntelBlock tone="up" section={intelligence.entry} />
        <IntelBlock tone="down" section={intelligence.exit} />
        <IntelBlock tone="info" section={intelligence.evidence} />
        <IntelBlock tone="warn" section={intelligence.contradictions} />
        <div className="pulse-levels">
          <div className="pulse-intel-kicker">KEY LEVELS</div>
          {intelligence.keyLevels.map((level) => (
            <div key={level.label} className="pulse-level-row">
              <span>{level.label}</span>
              <span className="num">{level.value}</span>
            </div>
          ))}
        </div>
        <p className="pulse-fixture-note">Phase 6A presentation fixture · not live model output</p>
      </div>
    </aside>
  );
}

function IntelBlock({
  tone,
  section,
}: {
  tone: "up" | "down" | "info" | "warn";
  section: { title: string; body: string };
}) {
  return (
    <section className={`pulse-intel-block ${tone}`}>
      <h3>{section.title}</h3>
      <p>{section.body}</p>
    </section>
  );
}
