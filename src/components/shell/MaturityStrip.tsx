import { maturityViews } from "@/api/envelope";
import type { MaturityMap } from "@/api/types";

export function MaturityStrip({ maturity }: { maturity: MaturityMap | null }) {
  const views = maturityViews(maturity);
  if (!views.length) {
    return (
      <div className="maturity-strip">
        Data maturity — awaiting backend envelope
      </div>
    );
  }
  return (
    <div className="maturity-strip" title="A probability is shown only after 60 pooled live days per class.">
      <span style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>MATURITY</span>
      {views.map((view) => {
        const label = view.class_key || "class";
        const reactKey =
          view.envelope_key ||
          [view.class_key, view.underlying].filter(Boolean).join(":") ||
          "class";
        const permitted = Boolean(view.probability_permitted);
        const display = view.display || "insufficient data";
        return (
          <span key={reactKey} style={{ color: permitted ? "var(--text-secondary)" : "var(--warning)" }}>
            {label}: {display}
          </span>
        );
      })}
    </div>
  );
}
